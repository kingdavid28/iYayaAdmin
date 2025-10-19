const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

// Authentication middleware: Handles Supabase JWT tokens
const authenticate = async (req, res, next) => {
  try {
    // FIRST: Check for dev bypass with X-Dev-Bypass header
    if (process.env.ALLOW_DEV_BYPASS === 'true' && req.header('X-Dev-Bypass') === '1') {
      const incoming = (req.header('X-Dev-Role') || 'caregiver').toLowerCase();

      // Map app-facing roles to internal roles
      const mapped = incoming === 'caregiver' || incoming === 'provider'
        ? 'caregiver'
        : 'parent';

      req.user = {
        id: 'dev-bypass-uid',
        supabaseId: 'dev-bypass-supabase-id',
        role: mapped,
        email: 'dev-bypass@example.com',
        bypass: true,
      };

      return next();
    }

    // SECOND: Check for dev mode without auth header
    if (process.env.ALLOW_DEV_BYPASS === 'true') {
      const authHeader = req.header('Authorization');
      if (!authHeader) {
        // Dev mode: No auth header, creating mock user
        const devRole = req.header('X-Dev-Role') || 'caregiver';
        req.user = {
          id: 'dev-mock-user',
          supabaseId: 'dev-mock-user',
          role: devRole,
          email: 'dev@example.com',
          mock: true
        };
        return next();
      }
    }

    // Get and validate authorization header
    const authHeader = req.header('Authorization');

    if (!authHeader) {
      return res.status(401).json({
        success: false,
        error: 'Authorization header missing',
        code: 'INVALID_TOKEN'
      });
    }

    // Extract token
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format. Use: Bearer <token>'
      });
    }

    // Check for mock token first in development
    if (process.env.NODE_ENV === 'development' && token.includes('mock-signature')) {
      req.user = {
        id: 'mock-user-123',
        supabaseId: 'mock-user-123',
        role: 'parent',
        email: 'mock@example.com',
        mock: true
      };
      return next();
    }

    // Validate Supabase JWT token
    try {
      // Initialize Supabase client for token verification
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        }
      );

      // Verify the JWT token with Supabase
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      }

      // Get user profile from Supabase users table
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user profile:', profileError);
        return res.status(401).json({
          success: false,
          error: 'User profile not found',
          code: 'USER_NOT_FOUND'
        });
      }

      // Set user data for request
      req.user = {
        id: profile?.id || user.id,
        supabaseId: user.id,
        role: profile?.role || 'parent',
        email: user.email,
        status: profile?.status || 'active',
        profile: profile || null
      };

      return next();

    } catch (supabaseError) {
      console.error('Supabase auth error:', supabaseError);
      return res.status(401).json({
        success: false,
        error: 'Token verification failed',
        code: 'INVALID_TOKEN'
      });
    }

  } catch (err) {
    console.error('Authentication error:', err.name, err.message);
    console.error('Full error:', err);

    let errorMessage = 'Invalid token';
    if (err.name === 'TokenExpiredError') {
      errorMessage = 'Token expired';
    } else if (err.name === 'JsonWebTokenError') {
      errorMessage = 'Invalid token';
    }

    return res.status(401).json({
      success: false,
      error: errorMessage,
      code: 'INVALID_TOKEN'
    });
  }
};

const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Not authenticated'
      });
    }

    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Requires one of these roles: ${roles.join(', ')}`,
        yourRole: req.user.role,
        requiredRoles: roles
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};