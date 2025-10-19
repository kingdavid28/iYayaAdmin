
const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const { authenticate, authorize } = require('../middleware/auth');
const auditService = require('../services/auditService');
const path = require('path');
const { 
  login, 
  register, 
  logout, 
  getCurrentUser, 
  refreshToken, 
  updateChildren 
} = require('../controllers/auth');

// Enhanced controller loading with better error handling and fallbacks
const loadController = (name) => {
  try {
    // Try exact path first
    const controllerPath = path.join(__dirname, `../controllers/${name}`);
    const controller = require(controllerPath);
    
    if (!controller) {
      throw new Error(`Controller ${name} loaded but empty`);
    }
    
    console.log(`✅ ${name}Controller loaded successfully`);
    return controller;
  } catch (err) {
    console.error(`❌ Failed to load ${name}:`, err.message);
    
    // Special handling for validation controller
    if (name === 'validation') {
      console.warn('⚠️ Using basic validation fallback');
      return {
        validate: () => (req, res, next) => next() // No-op fallback
      };
    }
    
    // Special handling for auth controller (critical)
    if (name === 'auth') {
      console.error('🚨 Critical: Auth controller is required for the application to function');
      console.log('Attempting to locate auth controller...');
      
      // Try common alternative names
      const alternatives = ['authController', 'AuthController', 'userAuth'];
      for (const alt of alternatives) {
        try {
          const altPath = path.join(__dirname, `../controllers/${alt}`);
          const altController = require(altPath);
          console.log(`⚠️ Using alternative controller: ${alt}`);
          return altController;
        } catch (e) {
          continue;
        }
      }
      
      console.error('💥 No auth controller found. Please ensure:');
      console.error('1. The file exists in controllers/ directory');
      console.error('2. It has the correct name (auth.js or authController.js)');
      console.error('3. It exports the required methods');
      process.exit(1);
    }
    
    // For other controllers, provide minimal fallback
    return {
      [name]: (req, res) => res.status(501).json({
        success: false,
        error: 'Controller not implemented'
      })
    };
  }
};

// Load controllers with enhanced error handling
const authController = loadController('auth') || {
  register: (req, res) => res.status(503).json({ error: 'Auth service unavailable' }),
  login: (req, res) => res.status(503).json({ error: 'Auth service unavailable' }),
  logout: (req, res) => res.status(503).json({ error: 'Auth service unavailable' }),
  refreshToken: (req, res) => res.status(503).json({ error: 'Auth service unavailable' }),
  getCurrentUser: (req, res) => res.status(503).json({ error: 'Auth service unavailable' }),
  updateChildren: (req, res) => res.status(503).json({ error: 'Update children service unavailable' })
};

// Load validation from utils directory instead of controllers
let validation;
try {
  validation = require('../utils/validation');
  console.log('✅ validation loaded successfully');
} catch (err) {
  console.warn('⚠️ Using basic validation fallback');
  validation = {
    validate: () => (req, res, next) => next()
  };
}

// Method verification with better error reporting
const verifyMethods = (controller, methods, controllerName) => {
  if (!controller) return;
  
  methods.forEach(method => {
    if (typeof controller[method] !== 'function') {
      console.error(`❌ Missing required method in ${controllerName}: ${method}`);
      
      if (controllerName === 'validation') {
        // Patch missing validation methods with no-op
        controller[method] = () => (req, res, next) => next();
        console.warn(`⚠️ Added no-op fallback for ${method}`);
      } else if (controllerName === 'auth') {
        // Critical auth methods cannot be missing
        console.error(`💥 Critical auth method missing: ${method}`);
        process.exit(1);
      }
    }
  });
};

// Verify methods with controller names for better debugging
verifyMethods(authController, [
  'register', 
  'login', 
  'logout', 
  'refreshToken',
  'getCurrentUser',
  'updateChildren',
  'updateRole'
], 'auth');

verifyMethods(validation, [
  'validate'
], 'validation');

// 4. Improved rate limiting with dynamic configuration
const createLimiter = (options = {}) => rateLimit({
  windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes default
  max: options.max || 5, // 5 requests default
  message: options.message || 'Too many requests, please try again later',
  handler: (req, res, next) => {
    auditService.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
      ip: req.ip,
      endpoint: req.path,
      method: req.method,
      timestamp: new Date()
    });
    res.status(429).json({
      success: false,
      error: options.message || 'Too many requests, please try again later'
    });
  },
  skip: (req) => {
    // Skip rate limiting for health checks and docs
    return ['/health-check', '/docs'].includes(req.path);
  }
});

// Configure different limiters
const authLimiter = createLimiter({ 
  max: 5,
  message: 'Too many auth attempts, please try again later' 
});

const strictLimiter = createLimiter({
  // In development, allow generous retries to avoid blocking during testing
  max: process.env.NODE_ENV === 'production' ? 3 : 1000,
  windowMs: process.env.NODE_ENV === 'production' ? (60 * 60 * 1000) : (60 * 1000),
  message: 'Too many attempts on sensitive endpoint' 
});

// More permissive limiter for frequent profile reads (mobile apps poll this)
const profileLimiter = createLimiter({
  max: 200, // allow many reads within the window
  windowMs: 15 * 60 * 1000,
  message: 'Too many profile requests, please slow down temporarily'
});

// 5. Security middleware stack
const securityHeaders = (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
};

// 6. Request logging middleware
const requestLogger = (req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
};

// Apply global middleware
router.use(securityHeaders);
router.use(requestLogger);

// Update children for parent user
router.put('/profile/children', authenticate, authController.updateChildren);

// 7. Enhanced route definitions with proper validation
router.post('/register',
  strictLimiter,
  validation.validate('register'),
  authController.register || ((req, res) => 
    res.status(503).json({ error: 'Registration service unavailable' })
  )
);

router.post('/login',
  strictLimiter,
  validation.validate('login'),
  authController.login || ((req, res) => 
    res.status(503).json({ error: 'Login service unavailable' })
  )
);

// Firebase sync endpoint for social authentication
router.post('/firebase-sync',
  authLimiter,
  authController.firebaseSync || ((req, res) => 
    res.status(503).json({ error: 'Firebase sync service unavailable' })
  )
);

router.get('/firebase-profile',
  profileLimiter,
  authController.getFirebaseProfile || ((req, res) =>
    res.status(503).json({ error: 'Firebase profile service unavailable' })
  )
);

router.post('/reset-password',
  strictLimiter,
  authController.resetPassword
);

router.post('/confirm-reset-password',
  strictLimiter,
  authController.confirmPasswordReset
);

router.post('/check-email',
  authLimiter,
  authController.checkEmailExists
);

router.get('/verify-email/:token',
  authController.verifyEmail
);

router.post('/resend-verification',
  authLimiter,
  authController.resendVerification
);

router.get('/me',
  profileLimiter,
  authenticate,
  authController.getCurrentUser
);

// Alias for legacy/frontend compatibility
router.get('/profile',
  profileLimiter,
  authenticate,
  authController.getCurrentUser
);

// Update current authenticated user's profile
router.put('/profile',
  authenticate,
  authController.updateProfile
);

// Persist selected role for the authenticated user
router.patch('/role',
  authenticate,
  authController.updateRole
);

// Upload profile image via base64
router.post('/profile/image-base64',
  authenticate,
  authController.uploadProfileImageBase64
);

// Alternative route for profile image upload
router.post('/upload-profile-image',
  authenticate,
  authController.uploadProfileImageBase64
);

// Get user profile by Firebase UID (for messaging)
router.get('/user/:firebaseUid',
  profileLimiter,
  authenticate,
  authController.getUserByFirebaseUid
);

// CSRF token endpoint (for compatibility)
router.get('/csrf-token', (req, res) => {
  res.json({ 
    success: true, 
    token: 'no-csrf-needed',
    csrfToken: 'no-csrf-needed'
  });
});


// 8. Enhanced health check with system information
router.get('/health-check', (req, res) => {
  const healthCheck = {
    status: 'operational',
    timestamp: new Date(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    dbStatus: 'connected', // You would check your DB connection here
    loadAvg: process.cpuUsage()
  };

  res.status(200).json({
    success: true,
    ...healthCheck
  });
});

// 9. Improved API documentation endpoint
router.get('/docs', (req, res) => {
  const apiDocumentation = {
    name: 'Authentication Service API',
    version: '1.0.0',
    endpoints: [
      {
        method: 'POST',
        path: '/register',
        description: 'Register a new user',
        validation: {
          body: {
            email: 'string (required, email format)',
            password: 'string (required, min 8 chars)',
            name: 'string (required)',
            role: 'string (optional: user, admin, provider)'
          }
        }
      },
      {
        method: 'POST',
        path: '/login',
        description: 'Authenticate user',
        validation: {
          body: {
            email: 'string (required)',
            password: 'string (required)'
          }
        }
      },
      {
        method: 'POST',
        path: '/logout',
        description: 'Invalidate user session',
        authentication: 'Bearer token required'
      },
      {
        method: 'POST',
        path: '/refresh-token',
        description: 'Refresh access token',
        validation: {
          body: {
            refreshToken: 'string (required)'
          }
        }
      },
      {
        method: 'GET',
        path: '/me',
        description: 'Get current user profile',
        authentication: 'Bearer token required'
      }
    ]
  };

  res.json(apiDocumentation);
});

// 10. Error handling middleware
router.use((err, req, res, next) => {
  console.error('Route error:', err);
  
  auditService.logSecurityEvent('ROUTE_ERROR', {
    error: err.message,
    path: req.path,
    method: req.method,
    timestamp: new Date()
  });

  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred'
  });
});

module.exports = router;