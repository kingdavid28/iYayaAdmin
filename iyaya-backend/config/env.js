// config/env.js
require('dotenv').config({ path: process.env.ENV_PATH || './.env' });
const chalk = require('chalk');
const Joi = require('joi');

// Check if we're using Supabase (primary) or MongoDB (legacy)
const usingSupabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY;
const usingMongoDB = process.env.MONGODB_URI;

// Define the schema for environment variables
const envVarsSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3000),
  
  // JWT Configuration
  JWT_SECRET: Joi.string().min(32).required()
    .description('JWT secret key (min 32 characters)'),
  JWT_REFRESH_SECRET: Joi.string().min(32)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional()
    })
    .description('JWT refresh token secret key (min 32 characters)'),
  JWT_EXPIRE: Joi.string().default('30m'),
  JWT_REFRESH_EXPIRE: Joi.string().default('7d'),
  JWT_COOKIE_EXPIRE: Joi.number().default(7),
  
  // CORS Configuration
  CORS_ORIGIN: Joi.string().default('*')
    .pattern(/^(\*|https?:\/\/[^,\s]+(,\s*https?:\/\/[^,\s]+)*)$/)
    .description('Comma-separated list of allowed origins or "*"'),
  
  // Database Configuration
  MONGODB_URI: Joi.string().when('SUPABASE_URL', {
    is: Joi.exist(),
    then: Joi.optional(),
    otherwise: Joi.required()
  }),
  
  // Supabase Configuration
  SUPABASE_URL: Joi.string().uri(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string(),
  SUPABASE_ANON_KEY: Joi.string(),
  SUPABASE_JWT_SECRET: Joi.string(),
  
  // Email Configuration
  EMAIL_HOST: Joi.string().required()
    .description('Server that will send the emails'),
  EMAIL_PORT: Joi.number().required()
    .description('Port to connect to the email server'),
  EMAIL_SECURE: Joi.boolean().default(false),
  EMAIL_USERNAME: Joi.string(),
  EMAIL_PASSWORD: Joi.string(),
  EMAIL_FROM: Joi.string().required()
    .description('The from field in the emails sent by the app'),
  
  // SSL Configuration
  SSL_CERT_PATH: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  SSL_KEY_PATH: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional()
    }),
  
  // Geocoder Configuration
  GEOCODER_PROVIDER: Joi.string().default('mapquest'),
  GEOCODER_API_KEY: Joi.string(),
  GEOCODER_CACHE_TTL: Joi.number().default(86400),
  
  // Rate Limiting
  RATE_LIMIT_MAX: Joi.number().default(100)
}).unknown()
  .xor('SUPABASE_URL', 'MONGODB_URI') // Require at least one database
  .with('SUPABASE_URL', ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY'])
  .with('EMAIL_USERNAME', 'EMAIL_PASSWORD');

const { value: envVars, error } = envVarsSchema
  .prefs({ errors: { label: 'key' } })
  .validate(process.env);

if (error) {
  console.error(chalk.red.bold('Config validation error:'), error.message);
  process.exit(1);
}

// Enhanced validation function
const validateEnv = () => {
  console.log('=== ENVIRONMENT DEBUG ===');
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('PORT:', process.env.PORT);
  console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);
  console.log('EMAIL_HOST:', process.env.EMAIL_HOST);
  console.log('EMAIL_PORT:', process.env.EMAIL_PORT);
  console.log('EMAIL_FROM:', process.env.EMAIL_FROM);
  console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
  console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
  console.log('========================');

  const requiredVariables = [
    "PORT",
    "NODE_ENV",
    "JWT_SECRET",
    "EMAIL_HOST",
    "EMAIL_PORT",
    "EMAIL_FROM",
  ];

  // Database validation
  if (usingSupabase) {
    if (!envVars.SUPABASE_URL || !envVars.SUPABASE_SERVICE_ROLE_KEY) {
      console.error(chalk.red.bold('Missing Supabase configuration'));
      process.exit(1);
    }
  } else if (usingMongoDB) {
    if (!envVars.MONGODB_URI) {
      console.error(chalk.red.bold('Missing MongoDB configuration'));
      process.exit(1);
    }
  } else {
    console.error(chalk.red.bold('Missing database configuration:'));
    console.error('- Either SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY for Supabase');
    console.error('- Or MONGODB_URI for MongoDB');
    process.exit(1);
  }

  // Validate email port
  if (isNaN(parseInt(envVars.EMAIL_PORT))) {
    console.error(chalk.red.bold('EMAIL_PORT must be a valid number'));
    process.exit(1);
  }

  console.log(chalk.green('✓ Environment variables validated'));
  console.log(chalk.blue(`- Environment: ${envVars.NODE_ENV}`));
  console.log(chalk.blue(`- Database: ${usingSupabase ? 'Supabase' : 'MongoDB'}`));
};

// Parse CORS origins
const parseCorsOrigins = (originString) => {
  if (!originString) return ["*"];
  if (originString === "*") return ["*"];
  return originString.split(",").map((o) => o.trim());
};

// CORS origin validation function
const corsOriginValidator = (origin, callback) => {
  const allowedOrigins = parseCorsOrigins(envVars.CORS_ORIGIN);
  
  // Allow requests with no origin (like mobile apps or curl requests)
  if (!origin) return callback(null, true);

  // Check if origin is in allowed list or wildcard is present
  if (
    allowedOrigins.includes("*") ||
    allowedOrigins.some(
      (o) =>
        origin === o || 
        (o.includes('://') && new URL(origin).hostname === new URL(o).hostname)
    )
  ) {
    return callback(null, true);
  }

  // Format the error message consistently
  const error = new Error(`Origin ${origin} not allowed by CORS`);
  error.status = 403;
  console.warn(`CORS blocked: ${origin}`);
  callback(error);
};

const config = {
  env: envVars.NODE_ENV,
  port: envVars.PORT,

  isProduction: envVars.NODE_ENV === 'production',
  isDevelopment: envVars.NODE_ENV === 'development',
  isTest: envVars.NODE_ENV === 'test',

  database: {
    type: usingSupabase ? 'supabase' : 'mongodb',
    uri: envVars.MONGODB_URI,
    supabase: {
      url: envVars.SUPABASE_URL,
      serviceRoleKey: envVars.SUPABASE_SERVICE_ROLE_KEY,
      anonKey: envVars.SUPABASE_ANON_KEY,
    },
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
      w: 'majority',
    },
  },

  supabase: {
    url: envVars.SUPABASE_URL,
    serviceRoleKey: envVars.SUPABASE_SERVICE_ROLE_KEY,
    anonKey: envVars.SUPABASE_ANON_KEY,
    jwtSecret: envVars.SUPABASE_JWT_SECRET,
  },

  jwt: {
    secret: envVars.JWT_SECRET,
    refreshSecret: envVars.JWT_REFRESH_SECRET || `${envVars.JWT_SECRET}_FALLBACK`,
    expiresIn: envVars.JWT_EXPIRE,
    refreshExpiresIn: envVars.JWT_REFRESH_EXPIRE,
    cookieExpire: envVars.JWT_COOKIE_EXPIRE,
    cookieSecure: envVars.NODE_ENV === 'production',
  },

  cors: {
    origin: corsOriginValidator,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'Accept',
      'Origin',
      'X-Refresh-Token',
    ],
    origins: parseCorsOrigins(envVars.CORS_ORIGIN),
  },

  email: {
    host: envVars.EMAIL_HOST,
    port: parseInt(envVars.EMAIL_PORT),
    secure: envVars.EMAIL_SECURE,
    auth: envVars.EMAIL_USERNAME ? {
      user: envVars.EMAIL_USERNAME,
      pass: envVars.EMAIL_PASSWORD,
    } : undefined,
    from: envVars.EMAIL_FROM,
    tls: {
      rejectUnauthorized: envVars.NODE_ENV === 'production',
    },
  },

  geocoder: {
    provider: envVars.GEOCODER_PROVIDER,
    apiKey: envVars.GEOCODER_API_KEY,
    cacheTTL: envVars.GEOCODER_CACHE_TTL,
    timeout: 5000,
  },

  ssl: {
    cert: envVars.SSL_CERT_PATH,
    key: envVars.SSL_KEY_PATH,
    certPath: envVars.SSL_CERT_PATH,
    keyPath: envVars.SSL_KEY_PATH,
  },

  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: envVars.RATE_LIMIT_MAX,
  },

  validate: validateEnv,
};

// Run validation immediately
// validateEnv(); // Temporarily disabled for debugging

module.exports = config;