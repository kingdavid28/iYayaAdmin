require('dotenv').config({ path: './.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const { authenticate, authorize } = require('./middleware/auth');
const config = require('./config/env');
const socketService = require('./services/socketService');

const app = express();

// ============================================
// Security Middleware
// ============================================
// Fixed rate limiter configuration (previous values were too large)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: { success: false, error: 'Too many requests from this IP, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' || (req.user?.role === 'admin') || (req.originalUrl?.startsWith('/api/messages')),
  // Use default IP-based key generation
});



app.use('/api', limiter);

// Parse CORS origins from environment variable with Expo Go support
const getExpoGoOrigins = () => {
  const commonPorts = [19000, 19001, 19002, 19006, 8081, 8082]; // Added 8082 for web app
  const commonIPs = [
    'localhost',
    '127.0.0.1',
    '192.168.1.11', 
    '192.168.1.10',  // Current network
    '192.168.0.10',   // Common home network  
    '10.0.0.10',      // Another common network
    '172.16.0.10',    // Corporate network
    '192.168.1.100',  // Extended range
    '192.168.0.100',  // Extended range
  ];
  
  const origins = [];
  
  // Add HTTP origins for all IP/port combinations
  commonIPs.forEach(ip => {
    commonPorts.forEach(port => {
      origins.push(`http://${ip}:${port}`);
    });
  });
  
  // Add Expo Go specific patterns
  origins.push(
    'exp://192.168.1.11:19000',
    'exp://192.168.1.10:19000',
    'exp://192.168.0.10:19000', 
    'exp://10.0.0.10:19000',
    'exp://172.16.0.10:19000',
    'exp://localhost:19000',
    'exp://127.0.0.1:19000'
  );
  
  return origins;
};

const corsOrigins = process.env.CORS_ORIGIN ? 
  process.env.CORS_ORIGIN.split(',').map(o => o.trim()) : 
  getExpoGoOrigins();

// CORS Configuration with Expo Go support
// CORS Configuration with Expo Go support
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Expo Go, or curl requests)
    if (!origin) return callback(null, true);

    // Check if origin is in allowed list
    if (corsOrigins.includes(origin)) {
      return callback(null, true);
    }

    // For development, also allow localhost with any port
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }

    // For development, also allow 127.0.0.1 with any port
    if (origin.startsWith('http://127.0.0.1:')) {
      return callback(null, true);
    }

    // Reject other origins
    return callback(new Error(`CORS policy violation: Origin ${origin} not allowed`), false);
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
    // ... existing code ...
    'X-Dev-Bypass', // allow dev bypass header
    'x-dev-bypass', // lowercase variant for browser preflight
    'X-Dev-Role'    // optional: role override during dev
  ],
  exposedHeaders: ['Authorization', 'X-Refresh-Token', 'X-Request-ID'],
  credentials: true,
  optionsSuccessStatus: 204,
  maxAge: 86400
};
// Apply CORS middleware
console.log('CORS Configuration:', {
  origins: corsOrigins,
  methods: corsOptions.methods,
  allowedHeaders: corsOptions.allowedHeaders
});

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Security Middleware - Added recommended Helmet configurations
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      // Add any additional CSP directives here
    },
  },
  crossOriginResourcePolicy: { policy: "same-site" },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: { maxAge: 15552000, includeSubDomains: true },
  ieNoOpen: true,
  noSniff: true,
  xssFilter: true
}));

// app.use(mongoSanitize()); // Temporarily disabled for debugging
// app.use(xss()); // Temporarily disabled for debugging
app.use(hpp());

// Request Processing
// Increase limits to support base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Serve verification page
app.get('/verify.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'verify.html'));
});
// Serve uploaded files with proper headers
app.use('/uploads', (req, res, next) => {
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, 'uploads')));

// ============================================
// Routes
// ============================================
const mountRoutes = () => {
  try {
    const apiRouter = express.Router();

    // Public Routes
    apiRouter.use('/auth', require('./routes/authRoutes'));

    // User routes with error handling
    try {
      apiRouter.use('/users', authenticate, require('./routes/userRoutes'));
    } catch (error) {
      console.warn('User routes not available:', error.message);
      apiRouter.use('/users', (req, res) => {
        res.status(501).json({ 
          success: false, 
          error: 'User routes not implemented' 
        });
      });
    }

    // Notification routes with error handling



    // Admin routes with authentication and authorization
    apiRouter.use('/caregivers', require('./routes/caregiverRoutes'));
    apiRouter.use('/profile', require('./routes/profileRoutes'));
    apiRouter.use('/contracts', authenticate, require('./routes/contractRoutes'));
    apiRouter.use('/bookings', authenticate, require('./routes/bookingRoutes'));
    apiRouter.use('/jobs', authenticate, require('./routes/jobsRoutes'));
    apiRouter.use('/applications', require('./routes/applicationsRoutes'));
    apiRouter.use('/children', require('./routes/childrenRoutes'));
    apiRouter.use('/uploads', authenticate, require('./routes/uploadsRoutes'));
    apiRouter.use('/privacy', require('./routes/privacy'));
    apiRouter.use('/payments', require('./routes/paymentRoutes'));
    apiRouter.use('/admin', require('./routes/adminRoutes'));
    apiRouter.use('/availability', authenticate, require('./routes/availability'));
    apiRouter.use('/messages', require('./routes/messagingRoutes'));
    apiRouter.use('/notifications', require('./routes/notificationRoutes'));
    apiRouter.use('/ratings', require('./routes/ratingRoutes'));

    app.use('/api', apiRouter);
  } catch (error) {
    console.error('Error mounting routes:', error);
  }
};

mountRoutes();

// ============================================
// Health Check & Development Endpoints
// ============================================
const authController = require('./controllers/auth');
// Use the standard authenticate middleware so we resolve Firebase or JWT and
// then delegate to the controller which returns a normalized profile shape
app.get('/api/auth/profile', authenticate, authController.getCurrentUser);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Server is running',
    environment: config.env,
    timestamp: new Date().toISOString()
  });
});

// ============================================
// Error Handler
// ============================================
app.use((err, req, res, next) => {
  // Log the error with more context
  console.error(`❌ [${new Date().toISOString()}] Global Error Handler:`, {
    message: err.message,
    name: err.name,
    status: err.status,
    statusCode: err.statusCode,
    stack: err.stack?.split('\n').slice(0, 3),
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });

  const statusCode = err.status || err.statusCode || 500;
  
  // Check if this is the "Invalid data format" error
  if (err.message === 'Invalid data format') {
    console.error('❌ Found "Invalid data format" in global handler:', {
      name: err.name,
      constructor: err.constructor.name,
      keys: Object.keys(err)
    });
  }
  
  const response = {
    success: false,
    error: err.message
  };

  // Only include stack trace in development
  if (config.env === 'development') {
    response.stack = err.stack;
    response.details = {
      url: req.originalUrl,
      method: req.method
    };
  }

  res.status(statusCode).json(response);
});

// 404 Handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`
  });
});

// Initialize Socket.IO when server starts
const server = require('http').createServer(app);
socketService.initialize(server);

module.exports = { app, server };