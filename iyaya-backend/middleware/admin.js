const User = require('../models/User');
const { logger } = require('../utils/logger');
const { RateLimiterMemory } = require('rate-limiter-flexible');

// Enhanced cache with automatic TTL cleanup
const adminCache = new Map();
const CACHE_TTL = 300000; // 5 minutes

// Set up periodic cache cleanup
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of adminCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      adminCache.delete(userId);
    }
  }
}, 60000); // Run every minute

// Rate limiter configuration
const adminCheckRateLimiter = new RateLimiterMemory({
  points: 10, // 10 attempts
  duration: 60, // per 60 seconds
  execEvenly: false // No delay between attempts
});

// Synchronous admin verification middleware
exports.requireAdmin = (req, res, next) => {
  try {
    // 1. Basic request validation
    if (!req.user?.id) {
      logger.warn('Admin check failed - no user in request', { 
        path: req.path,
        method: req.method,
        ip: req.ip 
      });
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const userId = req.user.id;

    // 2. Rate limiting (synchronous)
    try {
      const rateLimitRes = adminCheckRateLimiter.consumeSync(userId);
      if (rateLimitRes.remainingPoints <= 0) {
        logger.warn('Admin check rate limit exceeded', { 
          userId,
          ip: req.ip,
          path: req.path
        });
        return res.status(429).json({
          success: false,
          error: 'Too many verification attempts',
          code: 'RATE_LIMITED',
          retryAfter: Math.ceil(rateLimitRes.msBeforeNext / 1000)
        });
      }
    } catch (err) {
      logger.error('Rate limiter error:', err);
      // Allow to proceed if rate limiter fails
    }

    // 3. Cache check with validation
    if (adminCache.has(userId)) {
      const cacheEntry = adminCache.get(userId);
      
      // Validate cache entry
      if (Date.now() - cacheEntry.timestamp < CACHE_TTL) {
        if (cacheEntry.userStatus !== 'active') {
          return res.status(403).json({
            success: false,
            error: getStatusMessage(cacheEntry.userStatus),
            code: `ADMIN_${cacheEntry.userStatus.toUpperCase()}`
          });
        }

        if (cacheEntry.isAdmin) {
          req.adminVerifiedVia = 'cache';
          req.adminPrivilegeLevel = cacheEntry.userType;
          return next();
        }

        return res.status(403).json({
          success: false,
          error: 'Admin privileges required',
          code: 'ADMIN_ACCESS_DENIED'
        });
      }
      // Remove stale cache entry
      adminCache.delete(userId);
    }

    // 4. Database verification (sync)
    const user = User.findByIdSync(userId, 'userType status lastAdminCheck');
    
    if (!user) {
      logger.warn('Admin check failed - user not found', { userId });
      return res.status(401).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // 5. Status checks
    if (user.status !== 'active') {
      adminCache.set(userId, { 
        isAdmin: false,
        userType: user.userType,
        userStatus: user.status,
        timestamp: Date.now() 
      });

      return res.status(403).json({
        success: false,
        error: getStatusMessage(user.status),
        code: `ADMIN_${user.status.toUpperCase()}`
      });
    }

    // 6. Admin verification
    const isAdmin = ['admin', 'superadmin'].includes(user.userType);
    
    // Update cache
    adminCache.set(userId, {
      isAdmin,
      userType: user.userType,
      userStatus: user.status,
      timestamp: Date.now()
    });

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Administrative privileges required',
        code: 'ADMIN_ACCESS_DENIED',
        details: `User type: ${user.userType}`
      });
    }

    // 7. Success - attach admin context
    req.isAdmin = true;
    req.adminVerifiedVia = 'database';
    req.adminPrivilegeLevel = user.userType;
    
    // Async update without waiting
    User.updateOne({ _id: userId }, { 
      $set: { lastAdminCheck: new Date() } 
    }).catch(err => logger.error('Update error:', err));

    next();
  } catch (err) {
    logger.error('Admin verification error', { 
      error: err.message,
      stack: err.stack,
      userId: req.user?.id,
      path: req.path
    });
    
    res.status(500).json({
      success: false,
      error: 'Administrative verification failed',
      code: 'ADMIN_VERIFICATION_ERROR',
      ...(process.env.NODE_ENV === 'development' && { details: err.message })
    });
  }
};

// Helper function for status messages
function getStatusMessage(status) {
  const messages = {
    suspended: 'Admin account suspended',
    banned: 'Admin account banned',
    inactive: 'Admin account inactive'
  };
  return messages[status] || 'Admin account is not active';
}

// Enhanced role-based access control
exports.requireRoles = (roles, options = {}) => {
  // Validate and normalize roles input
  if (!Array.isArray(roles)) roles = [roles];
  
  // Default options
  const defaultOptions = {
    allowInactive: false,
    roleHierarchy: null,
    allowSelfAccess: false,
    resourceOwnerField: 'id'
  };
  
  const mergedOptions = { ...defaultOptions, ...options };

  return async (req, res, next) => {
    try {
      // 1. Authentication check
      if (!req.user?.id) {
        logger.warn('Role check failed - no authenticated user', {
          path: req.path,
          method: req.method,
          ip: req.ip
        });
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // 2. Get user data (using async now for better error handling)
      const user = await User.findById(req.user.id)
        .select('userType status')
        .lean();

      if (!user) {
        logger.warn('Role check failed - user not found', {
          userId: req.user.id,
          path: req.path
        });
        return res.status(401).json({
          success: false,
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // 3. Account status check
      if (user.status !== 'active' && !mergedOptions.allowInactive) {
        logger.warn('Role check failed - inactive account', {
          userId: user._id,
          status: user.status
        });
        return res.status(403).json({
          success: false,
          error: 'Account is not active',
          code: 'ACCOUNT_INACTIVE',
          currentStatus: user.status
        });
      }

      // 4. Self-access check (if enabled)
      if (mergedOptions.allowSelfAccess) {
        const resourceId = req.params[mergedOptions.resourceOwnerField] || req.body[mergedOptions.resourceOwnerField];
        if (resourceId && resourceId === req.user.id.toString()) {
          req.userRole = user.userType;
          req.bypassRoleCheck = true;
          return next();
        }
      }

      // 5. Role hierarchy check
      if (mergedOptions.roleHierarchy) {
        const hierarchy = mergedOptions.roleHierarchy;
        const userLevel = hierarchy.indexOf(user.userType);
        const requiredLevel = Math.min(...roles.map(r => hierarchy.indexOf(r)));

        if (userLevel >= requiredLevel) {
          req.userRole = user.userType;
          return next();
        }
      }

      // 6. Direct role check
      if (!roles.includes(user.userType)) {
        logger.warn('Role check failed - insufficient privileges', {
          userId: user._id,
          requiredRoles: roles,
          userRole: user.userType
        });
        return res.status(403).json({
          success: false,
          error: `Insufficient privileges. Required roles: ${roles.join(', ')}`,
          code: 'ROLE_ACCESS_DENIED',
          currentRole: user.userType,
          requiredRoles: roles
        });
      }

      // 7. Success - attach user role to request
      req.userRole = user.userType;
      next();
    } catch (err) {
      logger.error('Role verification error', {
        error: err.message,
        stack: err.stack,
        userId: req.user?.id,
        attemptedRoles: roles,
        path: req.path
      });

      res.status(500).json({
        success: false,
        error: 'Role verification failed',
        code: 'ROLE_VERIFICATION_ERROR',
        ...(process.env.NODE_ENV === 'development' && { details: err.message })
      });
    }
  };
};

// Cache management utilities
exports.clearAdminCache = (userId) => {
  adminCache.delete(userId);
};

exports.getAdminCacheSize = () => adminCache.size;

// Add to User model (if using mongoose):
// userSchema.statics.findByIdSync = function(id, select = '') {
//   try {
//     return this.findById(id)
//       .select(select)
//       .lean()
//       .execSync();
//   } catch (err) {
//     throw err;
//   }
// };