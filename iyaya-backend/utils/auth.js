const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/auth');
const User = require('../models/User');

/**
 * Consolidated Authentication and Authorization System
 * Combines functionality from middleware/auth.js and middleware/authorization.js
 */

// Role and user type mapping utilities
const roleMapping = {
  synonyms: {
    parent: new Set(['parent', 'client']),
    caregiver: new Set(['provider', 'caregiver', 'nanny']),
    admin: new Set(['admin', 'administrator']),
  },

  normalize: (type) => {
    if (!type || typeof type !== 'string') return undefined;
    const normalized = type.toLowerCase();
    
    for (const [canonical, synonyms] of Object.entries(roleMapping.synonyms)) {
      if (synonyms.has(normalized)) return canonical;
    }
    return normalized;
  },

  mapTokenRole: (tokenRole) => {
    const normalized = roleMapping.normalize(tokenRole);
    switch (normalized) {
      case 'provider':
      case 'caregiver':
        return 'caregiver';
      case 'client':
      case 'parent':
        return 'parent';
      case 'admin':
        return 'admin';
      default:
        return 'user';
    }
  },
};

// Development bypass functionality
const createDevBypassUser = async (req) => {
  if (process.env.NODE_ENV === 'production' || process.env.ALLOW_DEV_BYPASS !== 'true') {
    return null;
  }

  if (req.header('X-Dev-Bypass') !== '1') {
    return null;
  }

  console.log('🔧 Dev bypass activated');
  const incomingRole = (req.header('X-Dev-Role') || 'parent').toLowerCase();
  const mappedRole = roleMapping.mapTokenRole(incomingRole);
  
  const devUser = {
    id: 'dev-bypass-uid',
    mongoId: 'dev-bypass-mongo-id',
    role: mappedRole,
    userType: mappedRole,
    email: 'dev-bypass@example.com',
    bypass: true,
  };

  // Try to map to existing DB user
  try {
    const dbUser = await User.findOne({ email: devUser.email.toLowerCase() })
      .select('_id role userType');
    if (dbUser) {
      devUser.mongoId = dbUser._id;
      if (dbUser.role) devUser.role = dbUser.role;
      if (dbUser.userType) devUser.userType = dbUser.userType;
      console.log('🔧 Dev bypass mapped to DB user:', dbUser._id);
    }
  } catch (error) {
    console.warn('Dev bypass DB mapping failed:', error.message);
  }

  console.log('🔧 Dev bypass user created:', devUser);
  return devUser;
};

// Enhanced JWT verification with role mapping
const verifyAndMapToken = async (token) => {
  try {
    const decoded = jwt.verify(token, jwtSecret, {
      algorithms: ['HS256'],
      ignoreExpiration: false,
    });

    let userType = roleMapping.mapTokenRole(decoded.role);

    // Special handling for legacy 'client' tokens
    if (decoded.role === 'client') {
      try {
        const user = await User.findById(decoded.id).select('role userType');
        if (user && (user.role === 'caregiver' || user.userType === 'provider')) {
          userType = 'caregiver';
        } else {
          userType = 'parent';
        }
      } catch (dbError) {
        console.error('Error checking user profile for role mapping:', dbError);
        userType = 'parent'; // fallback
      }
    }

    return {
      id: decoded.id,
      mongoId: decoded.id,
      role: decoded.role || 'user',
      userType: userType,
      email: decoded.email,
      iat: decoded.iat,
      exp: decoded.exp,
    };
  } catch (error) {
    throw error;
  }
};

// Main authentication middleware
const authenticate = async (req, res, next) => {
  try {
    // Check for development bypass
    const devUser = await createDevBypassUser(req);
    if (devUser) {
      req.user = devUser;
      return next();
    }

    // Get and validate authorization header
    const authHeader = req.header('Authorization');
    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header missing',
        code: 'MISSING_AUTH_HEADER',
      });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format. Use: Bearer <token>',
        code: 'INVALID_TOKEN_FORMAT',
      });
    }

    // Verify and map token
    const user = await verifyAndMapToken(token);
    req.user = user;
    
    next();
  } catch (error) {
    console.error('Authentication error:', error.name, error.message);
    
    let errorMessage = 'Authentication failed';
    let errorCode = 'AUTH_FAILED';
    
    if (error.name === 'TokenExpiredError') {
      errorMessage = 'Token expired';
      errorCode = 'TOKEN_EXPIRED';
    } else if (error.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token';
      errorCode = 'INVALID_TOKEN';
    } else if (error.name === 'NotBeforeError') {
      errorMessage = 'Token not active yet';
      errorCode = 'TOKEN_NOT_ACTIVE';
    }

    return res.status(401).json({
      success: false,
      error: errorMessage,
      code: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Role-based authorization middleware
const authorize = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
    }

    // Convert single role to array
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    if (roles.length === 0) {
      // No specific roles required, just authentication
      return next();
    }

    // Build allowed set including synonyms
    const allowedSet = new Set();
    for (const role of roles) {
      const normalized = roleMapping.normalize(role);
      allowedSet.add(role);
      if (normalized) {
        allowedSet.add(normalized);
        // Include all synonyms for the normalized role
        const synonyms = roleMapping.synonyms[normalized];
        if (synonyms) {
          synonyms.forEach(synonym => allowedSet.add(synonym));
        }
      }
    }

    const userRole = roleMapping.normalize(req.user.role);
    const userType = roleMapping.normalize(req.user.userType);
    
    const isAllowed = allowedSet.has(req.user.role) || 
                     allowedSet.has(req.user.userType) ||
                     (userRole && allowedSet.has(userRole)) ||
                     (userType && allowedSet.has(userType));

    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Requires one of these roles: ${roles.join(', ')}`,
        code: 'INSUFFICIENT_PERMISSIONS',
        userRole: req.user.role,
        userType: req.user.userType,
        requiredRoles: roles,
      });
    }

    next();
  };
};

// User type specific authorization (legacy compatibility)
const checkUserType = (allowedTypes) => {
  return authorize(allowedTypes);
};

// Admin-only authorization
const requireAdmin = () => authorize(['admin']);

// Parent-only authorization
const requireParent = () => authorize(['parent', 'client']);

// Caregiver-only authorization
const requireCaregiver = () => authorize(['caregiver', 'provider', 'nanny']);

// Self or admin authorization (for profile access)
const requireSelfOrAdmin = (userIdParam = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const targetUserId = req.params[userIdParam];
    const isAdmin = roleMapping.normalize(req.user.role) === 'admin';
    const isSelf = req.user.mongoId === targetUserId || req.user.id === targetUserId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Can only access your own data or admin required',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    next();
  };
};

// Token generation utilities
const generateTokens = (user) => {
  const payload = {
    id: user._id || user.id,
    email: user.email,
    role: user.role || user.userType,
  };

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' },
    jwtSecret,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );

  return { accessToken, refreshToken };
};

const verifyRefreshToken = (token) => {
  try {
    const decoded = jwt.verify(token, jwtSecret);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token type');
    }
    return decoded;
  } catch (error) {
    throw error;
  }
};

// Rate limiting helpers
const createRateLimitKey = (req, identifier = 'ip') => {
  switch (identifier) {
    case 'user':
      return req.user ? `user:${req.user.id}` : `ip:${req.ip}`;
    case 'email':
      return req.body?.email ? `email:${req.body.email}` : `ip:${req.ip}`;
    default:
      return `ip:${req.ip}`;
  }
};

module.exports = {
  // Main middleware functions
  authenticate,
  authorize,
  checkUserType, // Legacy compatibility
  
  // Convenience middleware
  requireAdmin,
  requireParent,
  requireCaregiver,
  requireSelfOrAdmin,
  
  // Token utilities
  generateTokens,
  verifyRefreshToken,
  verifyAndMapToken,
  
  // Role mapping utilities
  roleMapping,
  
  // Rate limiting helpers
  createRateLimitKey,
  
  // Development utilities
  createDevBypassUser,
};
