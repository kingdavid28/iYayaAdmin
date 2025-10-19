/**
 * Consolidated Backend Configuration System
 * Centralizes all configuration constants, environment variables, and settings
 */

// Environment configuration
const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: process.env.PORT || 3000,
  
  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/iyaya',
  
  // Authentication
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  JWT_COOKIE_EXPIRE: process.env.JWT_COOKIE_EXPIRE || 24 * 60 * 60 * 1000, // 24 hours in ms
  
  // Development flags
  ALLOW_DEV_BYPASS: process.env.ALLOW_DEV_BYPASS === 'true',
  
  // External services
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
  
  // File upload
  MAX_FILE_SIZE: process.env.MAX_FILE_SIZE || 5 * 1024 * 1024, // 5MB
  UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
  
  // Email
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT || 587,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  FROM_EMAIL: process.env.FROM_EMAIL,
  
  // Rate limiting
  RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW || 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
  
  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
};

// Regular expressions
const regEx = {
  password: /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/,
  objectId: /^[0-9a-fA-F]{24}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  phoneNumber: /^\+?[\d\s\-\(\)]{10,}$/,
  zipCode: /^\d{5}(-\d{4})?$/,
  url: /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/,
};

// Application constants
const constants = {
  // User roles and types
  USER_ROLES: {
    ADMIN: 'admin',
    PARENT: 'parent',
    CAREGIVER: 'caregiver',
    USER: 'user',
  },
  
  USER_TYPES: {
    ADMIN: 'admin',
    PARENT: 'parent',
    CLIENT: 'client', // Legacy alias for parent
    CAREGIVER: 'caregiver',
    PROVIDER: 'provider', // Legacy alias for caregiver
    NANNY: 'nanny', // Legacy alias for caregiver
  },
  
  // Booking statuses
  BOOKING_STATUS: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    CANCELLED: 'cancelled',
    COMPLETED: 'completed',
    IN_PROGRESS: 'in_progress',
  },
  
  // Job statuses
  JOB_STATUS: {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
    FILLED: 'filled',
    CANCELLED: 'cancelled',
    EXPIRED: 'expired',
  },
  
  // Application statuses
  APPLICATION_STATUS: {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    REJECTED: 'rejected',
    WITHDRAWN: 'withdrawn',
  },
  
  // Payment statuses
  PAYMENT_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    FAILED: 'failed',
    REFUNDED: 'refunded',
  },
  
  // File types
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  
  // Pagination
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  
  // Cache TTL (in seconds)
  CACHE_TTL: {
    SHORT: 5 * 60, // 5 minutes
    MEDIUM: 30 * 60, // 30 minutes
    LONG: 24 * 60 * 60, // 24 hours
  },
  
  // Error codes
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
    AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
    NOT_FOUND: 'NOT_FOUND',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
  
  // Success codes
  SUCCESS_CODES: {
    CREATED: 'CREATED',
    UPDATED: 'UPDATED',
    DELETED: 'DELETED',
    RETRIEVED: 'RETRIEVED',
  },
};

// Database configuration
const database = {
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  },
  
  collections: {
    USERS: 'users',
    BOOKINGS: 'bookings',
    JOBS: 'jobs',
    APPLICATIONS: 'applications',
    REVIEWS: 'reviews',
    PAYMENTS: 'payments',
    NOTIFICATIONS: 'notifications',
  },
};

// Authentication configuration
const auth = {
  jwtSecret: env.JWT_SECRET,
  refreshTokenSecret: env.JWT_REFRESH_SECRET,
  jwtExpiry: env.JWT_EXPIRES_IN,
  jwtExpire: env.JWT_EXPIRES_IN, // Legacy compatibility
  refreshTokenExpiry: env.JWT_REFRESH_EXPIRES_IN,
  cookieExpiry: env.JWT_COOKIE_EXPIRE,
  
  // Password requirements
  password: {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSpecialChars: true,
  },
  
  // Session configuration
  session: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
  },
};

// Rate limiting configuration
const rateLimiting = {
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: 'Too many authentication attempts, please try again later',
  },
  
  api: {
    windowMs: env.RATE_LIMIT_WINDOW,
    max: env.RATE_LIMIT_MAX_REQUESTS,
    message: 'Too many requests, please try again later',
  },
  
  upload: {
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 uploads per minute
    message: 'Too many file uploads, please try again later',
  },
};

// CORS configuration
const cors = {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Dev-Bypass', 'X-Dev-Role'],
};

// Logging configuration
const logging = {
  level: env.LOG_LEVEL,
  format: env.NODE_ENV === 'production' ? 'json' : 'combined',
  
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    http: 3,
    debug: 4,
  },
};

// Utility functions
const utils = {
  isDevelopment: () => env.NODE_ENV === 'development',
  isProduction: () => env.NODE_ENV === 'production',
  isTest: () => env.NODE_ENV === 'test',
  
  getEnvVar: (key, defaultValue = null) => {
    const value = process.env[key];
    if (value === undefined || value === null || value === '') {
      if (defaultValue !== null) return defaultValue;
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  },
  
  parseBoolean: (value) => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true' || value === '1';
    }
    return Boolean(value);
  },
  
  parseNumber: (value, defaultValue = 0) => {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  },
};

// Validation helpers
const validation = {
  isValidObjectId: (id) => regEx.objectId.test(id),
  isValidEmail: (email) => regEx.email.test(email),
  isValidPassword: (password) => regEx.password.test(password),
  isValidPhoneNumber: (phone) => regEx.phoneNumber.test(phone),
  isValidUrl: (url) => regEx.url.test(url),
  
  sanitizeString: (str) => {
    if (typeof str !== 'string') return '';
    return str.trim().replace(/\s+/g, ' ');
  },
  
  normalizeEmail: (email) => {
    if (typeof email !== 'string') return '';
    return email.toLowerCase().trim();
  },
};

module.exports = {
  env,
  regEx,
  constants,
  database,
  auth,
  rateLimiting,
  cors,
  logging,
  utils,
  validation,
  
  // Legacy exports for backward compatibility
  jwtSecret: auth.jwtSecret,
  refreshTokenSecret: auth.refreshTokenSecret,
  jwtExpiry: auth.jwtExpiry,
  jwtExpire: auth.jwtExpire,
  refreshTokenExpiry: auth.refreshTokenExpiry,
  cookieExpiry: auth.cookieExpiry,
};
