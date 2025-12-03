require('dotenv').config({ path: './.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { authenticate, authorize } = require('./middleware/auth');
const config = require('./config/env');
const socketService = require('./services/socketService');
const logger = require('./config/logger');

// Initialize express app
const app = express();

// ============================================
// Security Middleware
// ============================================
// Security headers with custom CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    dnsPrefetchControl: { allow: false },
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 15552000, includeSubDomains: true },
    ieNoOpen: true,
    noSniff: true,
    xssFilter: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) =>
    process.env.NODE_ENV === 'development' ||
    req.user?.role === 'admin' ||
    req.originalUrl?.startsWith('/api/messages'),
});

app.use('/api', limiter);

// Parse CORS origins from environment variable with Expo Go support
const getExpoGoOrigins = () => {
  const commonPorts = [19000, 19001, 19002, 19006, 8081, 8082, 5000];
  const commonIPs = [
    'localhost',
    '127.0.0.1',
    '192.168.1.5',
    '192.168.1.10',
    '192.168.1.101',
    '192.168.0.10',
    '10.0.0.10',
    '172.16.0.10',
    '192.168.1.100',
    '192.168.0.100',
    '192.168.100.35',
  ];

  const origins = [];

  // Add HTTP origins for all IP/port combinations
  commonIPs.forEach((ip) => {
    commonPorts.forEach((port) => {
      origins.push(`http://${ip}:${port}`);
    });
  });

  // Add Expo Go specific patterns
  return [
    ...origins,
    'exp://192.168.1.5:19000',
    'exp://192.168.1.10:19000',
    'exp://192.168.1.101:19000',
    'exp://192.168.0.10:19000',
    'exp://10.0.0.10:19000',
    'exp://172.16.0.10:19000',
    'exp://localhost:19000',
    'exp://127.0.0.1:19000',
    'https://iyaya-backend.vercel.app',
    'https://i-yaya-admin.vercel.app',
    'https://iyaya-backend-8k1q0bnbg-reycelrcentino-1494s-projects.vercel.app',
    'http://192.168.1.101:19000',
    'http://192.168.1.101:8081',
    'http://192.168.1.101:8082',
    'http://192.168.1.101:5000',
    'http://192.168.1.101:8080',
    'http://192.168.1.101:8083',
    'http://192.168.1.101:8084',
    'http://192.168.1.101:8085',
  ];
};

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : getExpoGoOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin) || 
        origin.startsWith('http://localhost:') || 
        origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'Origin',
    'x-device-id',
    'x-app-version',
    'x-auth-token',
    'platform',
    'X-Dev-Bypass',
    'x-dev-bypass',
    'X-Dev-Role',
    'X-Refresh-Token',
    'X-Request-ID',
  ],
  exposedHeaders: ['Authorization', 'X-Refresh-Token', 'X-Request-ID'],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Request logging
app.use(morgan('combined', { stream: logger.stream }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Data sanitization
app.use(hpp());

// Compression
app.use(compression());

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoints
app.get(['/health', '/api/health'], (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running (Supabase Mode)',
    environment: config.env,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: 'supabase',
    version: '2.0.0-supabase',
  });
});

// Serve admin dashboard
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Serve verification page
app.get('/verify.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});

// Serve uploaded files with proper headers
app.use(
  '/uploads',
  (req, res, next) => {
    res.header('Cross-Origin-Resource-Policy', 'cross-origin');
    res.header('Access-Control-Allow-Origin', '*');
    next();
  },
  express.static(path.join(__dirname, 'uploads'))
);

// ============================================
// Routes
// ============================================
const mountRoutes = () => {
  try {
    const apiRouter = express.Router();

    // Public Routes - Use Supabase auth routes
    apiRouter.use('/auth', require('./routes/authSupabaseRoutes'));

    // User routes with error handling
    try {
      apiRouter.use('/users', authenticate, require('./routes/userRoutes'));
    } catch (error) {
      console.warn('User routes not available:', error.message);
      apiRouter.use('/users', (req, res) => {
        res.status(501).json({
          success: false,
          error: 'User routes not implemented',
        });
      });
    }

    // Protected routes
    apiRouter.use('/caregivers', require('./routes/caregiverRoutes'));
    apiRouter.use('/profile', require('./routes/profileRoutes'));
    apiRouter.use(
      '/contracts',
      authenticate,
      require('./routes/contractRoutes')
    );
    apiRouter.use('/bookings', authenticate, require('./routes/bookingRoutes'));
    apiRouter.use('/jobs', authenticate, require('./routes/jobsRoutes'));
    apiRouter.use('/applications', require('./routes/applicationsRoutes'));
    apiRouter.use('/children', require('./routes/childrenRoutes'));
    apiRouter.use('/uploads', authenticate, require('./routes/uploadsRoutes'));
    apiRouter.use('/privacy', require('./routes/privacy'));
    apiRouter.use('/payments', require('./routes/paymentRoutes'));
    apiRouter.use('/admin', require('./routes/adminRoutes'));
    apiRouter.use(
      '/availability',
      authenticate,
      require('./routes/availability')
    );
    apiRouter.use('/messages', require('./routes/messagingSupabaseRoutes'));
    apiRouter.use('/notifications', require('./routes/notificationRoutes'));
    apiRouter.use('/ratings', require('./routes/ratingRoutes'));

    app.use('/api', apiRouter);
  } catch (error) {
    logger.error('Error mounting routes:', error);
  }
};

mountRoutes();

// ============================================
// Error Handling
// ============================================
// 404 Handler for undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  
  logger.error(`[${new Date().toISOString()}] ${statusCode} - ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const response = {
    success: false,
    error: process.env.NODE_ENV === 'production' && statusCode === 500 
      ? 'Internal Server Error' 
      : err.message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = {
      name: err.name,
      status: err.status,
      statusCode: err.statusCode,
    };
  }

  res.status(statusCode).json(response);
});

// Socket.IO is disabled for Vercel serverless compatibility
// Uncomment below if deploying to a traditional server environment
// const server = require('http').createServer(app);
// socketService.initialize(server);

module.exports = app;
