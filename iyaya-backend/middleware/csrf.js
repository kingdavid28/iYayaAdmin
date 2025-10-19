const crypto = require('crypto');

// Simple CSRF protection middleware
const csrfProtection = () => {
  return (req, res, next) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip CSRF for API endpoints with JWT authentication
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
      return res.status(403).json({
        success: false,
        error: 'Invalid CSRF token'
      });
    }

    next();
  };
};

// Generate CSRF token
const generateCSRFToken = (req, res, next) => {
  if (!req.session) {
    req.session = {};
  }
  
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  
  next();
};

module.exports = {
  csrfProtection,
  generateCSRFToken
};