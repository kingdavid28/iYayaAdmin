require('dotenv').config();

// Check if we're using Supabase (primary) or MongoDB (legacy)
const usingSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
const usingMongoDB = process.env.MONGODB_URI;

const validateEnv = () => {

  // Base required variables (always needed)
  const requiredVariables = [
    'PORT',
    'NODE_ENV',
    'JWT_SECRET',
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_FROM'
  ];

  // Add database-specific requirements
  if (usingSupabase) {
    requiredVariables.push('SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY');
  } else if (usingMongoDB) {
    requiredVariables.push('MONGODB_URI');
  } else {
    // If neither is configured, require at least one
    console.error('Missing database configuration:');
    console.error('- Either SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY for Supabase');
    console.error('- Or MONGODB_URI for MongoDB');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    requiredVariables.push(
      'JWT_REFRESH_SECRET',
      'CORS_ORIGIN',
      'SSL_CERT_PATH',
      'SSL_KEY_PATH'
    );
  }

  const missingVariables = requiredVariables.filter(v => !process.env[v]?.trim());

  if (missingVariables.length > 0) {
    console.error(chalk.red.bold('Missing required environment variables:'));
    missingVariables.forEach(v => {
      console.error(chalk.yellow(`- ${v}`));
    });
    process.exit(1);
  }

  // Validate JWT secrets
  if (process.env.JWT_SECRET?.length < 32) {
    console.error(chalk.red.bold('JWT_SECRET must be at least 32 characters long'));
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production' && process.env.JWT_REFRESH_SECRET?.length < 32) {
    console.error(chalk.red.bold('JWT_REFRESH_SECRET must be at least 32 characters long in production'));
    process.exit(1);
  }

  // Validate email configuration
  if (isNaN(parseInt(process.env.EMAIL_PORT))) {
    console.error(chalk.red.bold('EMAIL_PORT must be a valid number'));
    process.exit(1);
  }

  // Validate CORS origin format
  if (process.env.CORS_ORIGIN && !/^(\*|https?:\/\/[^,\s]+(,\s*https?:\/\/[^,\s]+)*)$/.test(process.env.CORS_ORIGIN)) {
    console.error(chalk.red.bold('CORS_ORIGIN must be either "*" or a comma-separated list of valid URLs'));
    process.exit(1);
  }

  console.log('✓ Environment variables validated');
};

const parseCorsOrigins = (originString) => {
  if (!originString) return ['*'];
  if (originString === '*') return ['*'];
  return originString.split(',').map(o => o.trim());
};

module.exports = {
  port: parseInt(process.env.PORT) || 5000,
  env: process.env.NODE_ENV || 'development',

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',

  database: {
    // Support both Supabase and MongoDB (legacy)
    type: usingSupabase ? 'supabase' : 'mongodb',
    uri: process.env.MONGODB_URI,
    supabase: {
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      anonKey: process.env.SUPABASE_ANON_KEY
    },
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority'
    }
  },

  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: process.env.SUPABASE_ANON_KEY,
    jwtSecret: process.env.SUPABASE_JWT_SECRET
  },

  jwt: {
    secret: process.env.JWT_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET || `${process.env.JWT_SECRET}_FALLBACK`,
    expiresIn: process.env.JWT_EXPIRE || '30m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    cookieExpire: parseInt(process.env.JWT_COOKIE_EXPIRE) || 7,
    cookieSecure: process.env.NODE_ENV === 'production'
  },

  cors: {
    origin: (origin, callback) => {
      const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      // Check if origin is in allowed list or wildcard is present
      if (allowedOrigins.includes('*') || allowedOrigins.some(o => 
        origin === o || 
        new URL(origin).hostname === new URL(o).hostname
      )) {
        return callback(null, true);
      }
      
      // Format the error message consistently
      const error = new Error(`Origin ${origin} not allowed by CORS`);
      error.status = 403;
      console.warn(`CORS blocked: ${origin}`);
      callback(error);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Refresh-Token'
    ]
  },

  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD
    },
    from: process.env.EMAIL_FROM,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production'
    }
  },

  geocoder: {
    provider: process.env.GEOCODER_PROVIDER || 'mapquest',
    apiKey: process.env.GEOCODER_API_KEY,
    cacheTTL: parseInt(process.env.GEOCODER_CACHE_TTL) || 86400,
    timeout: 5000
  },

  ssl: {
    cert: process.env.SSL_CERT_PATH,
    key: process.env.SSL_KEY_PATH
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 100
  },

  validate: validateEnv
};

// Run validation immediately
validateEnv();