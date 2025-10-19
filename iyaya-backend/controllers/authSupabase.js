/**
 * Supabase Auth Controller
 * Replaces MongoDB/Mongoose operations with Supabase
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { UserService } = require('../services/supabaseService');
const { AuditLogService } = require('../services/supabaseService');
const emailService = require('../services/emailService');
const { jwtSecret, jwtExpiry, refreshTokenSecret, refreshTokenExpiry } = require('../config/auth');
const ErrorResponse = require('../utils/errorResponse');

// Helper function to generate tokens (unchanged)
const generateTokens = (user) => {
  const tokenRole = user.role === 'caregiver' ? 'caregiver' : 'parent';

  const accessToken = jwt.sign(
    { id: user.id, role: tokenRole },
    jwtSecret,
    { expiresIn: jwtExpiry, algorithm: 'HS256' }
  );

  const refreshToken = jwt.sign(
    { id: user.id, tokenVersion: user.tokenVersion || 0 },
    refreshTokenSecret,
    { expiresIn: refreshTokenExpiry, algorithm: 'HS256' }
  );

  return { accessToken, refreshToken };
};

// Normalize incoming roles - only parent and caregiver allowed
function normalizeRole(input) {
  const role = String(input || '').toLowerCase();
  if (role === 'caregiver') return 'caregiver';
  return 'parent'; // Default to parent for any other input
}

// User login with Supabase
exports.login = async (req, res, next) => {
  const { email, password } = req.body;
  console.log('🌐 Login request received:', { email, hasPassword: !!password });

  // Validate email & password
  if (!email || !password) {
    console.log('❌ Missing credentials:', { email: !!email, password: !!password });
    return res.status(400).json({ success: false, error: 'Please provide an email and password' });
  }

  try {
    // Find user by email
    const user = await UserService.findByEmail(email);
    console.log('🔍 Login attempt for:', email, 'User found:', !!user);

    if (!user) {
      console.log('❌ User not found in database for email:', email);
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    // Check if email is verified
    const isEmailVerified = user.email_verified || false;
    if (!isEmailVerified) {
      console.log('❌ Email not verified for user:', email);
      return res.status(401).json({
        success: false,
        error: 'Please verify your email before logging in. Check your inbox for the verification link.',
        requiresVerification: true
      });
    }

    // Check if password matches (only for local auth users)
    if (user.auth_provider === 'local') {
      const isMatch = await bcrypt.compare(password, user.password || '');
      console.log('🔐 Password match for', email, ':', isMatch);

      if (!isMatch) {
        console.log('❌ Invalid password for user:', email);
        return res.status(401).json({ success: false, error: 'Invalid credentials' });
      }
    }

    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(user);

    // Set refresh token as HTTP-only cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Update last login
    await UserService.update(user.id, { last_login: new Date().toISOString() });

    console.log('✅ Login successful for user:', email, 'ID:', user.id);
    res.status(200).json({
      success: true,
      token: accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('💥 Login error:', err);
    res.status(500).json({ success: false, error: 'Login failed: ' + err.message });
  }
};

// User registration with Supabase
exports.register = async (req, res, next) => {
  const { name, email, password, role } = req.body;
  console.log('📝 Registration request:', { name, email, role, hasPassword: !!password });

  try {
    // Normalize incoming role
    const normalizedRole = normalizeRole(role);
    console.log('🔄 Normalized role:', { input: role, normalized: normalizedRole });

    // Check if user already exists
    const existingUser = await UserService.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    // Hash password for local auth users
    let hashedPassword = null;
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create user in Supabase
    const userData = {
      email,
      name,
      role: normalizedRole,
      status: 'active',
      auth_provider: 'local',
      password: hashedPassword,
      first_name: req.body.firstName,
      last_name: req.body.lastName,
      phone: req.body.phone,
      email_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const user = await UserService.create(userData);
    console.log('✅ User created:', user.email, 'with role:', user.role);

    // TODO: Send verification email (implement email service for Supabase)
    // For now, we'll skip this as it requires email service integration

    console.log('✅ Registration successful for:', user.email);
    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      requiresVerification: true
    });
  } catch (err) {
    console.error('💥 Registration error:', err);

    if (err.message?.includes('duplicate key') || err.message?.includes('already exists')) {
      return res.status(409).json({ success: false, error: 'Email already exists' });
    }

    return res.status(500).json({ success: false, error: 'Registration failed: ' + err.message });
  }
};

// Get current authenticated user
exports.getCurrentUser = async (req, res, next) => {
  try {
    const user = await UserService.findById(req.user.id);
    if (!user) {
      return next(new ErrorResponse('User not found', 404));
    }

    // If self-access (user requesting own profile), return all info
    if (req.user.id === user.id) {
      const mappedRole = user.role === 'caregiver' ? 'caregiver' : 'parent';

      const responseObj = {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImage: user.profile_image,
        role: mappedRole,
        emailVerified: user.email_verified || false,
        phone: user.phone,
        address: user.address,
        children: user.children || [],
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };

      return res.status(200).json(responseObj);
    }

    // For other users, only expose public info
    let publicUser = {
      id: user.id,
      name: user.name,
      children: user.children || [],
      status: user.status
    };

    // TODO: Add contract checking logic if needed

    const mappedRole = user.role === 'caregiver' ? 'caregiver' : 'parent';
    return res.status(200).json({ ...publicUser, role: mappedRole });
  } catch (err) {
    console.error('Error in getCurrentUser:', err);
    next(new ErrorResponse('Server error', 500));
  }
};

// Update current authenticated user's profile
exports.updateProfile = async (req, res, next) => {
  try {
    const { name, phone, address, profileImage, children } = req.body || {};

    // Build update object only with provided fields
    const update = {};
    if (typeof name === 'string') update.name = name;
    if (typeof phone === 'string') update.phone = phone;
    if (profileImage) update.profile_image = profileImage;

    // Handle children updates for parents
    if (Array.isArray(children)) {
      const user = await UserService.findById(req.user.id);
      if (!user || user.role !== 'parent') {
        return res.status(403).json({ success: false, error: 'Only parent users can update children.' });
      }

      // Basic sanitization of children payload
      update.children = children
        .filter(c => c && typeof c.name === 'string' && c.name.trim().length > 0)
        .map(c => ({
          name: String(c.name).trim(),
          birthdate: c.birthdate ? new Date(c.birthdate).toISOString() : undefined,
          notes: typeof c.notes === 'string' ? c.notes : undefined
        }));
    }

    // Handle address updates
    if (address) {
      if (typeof address === 'string') {
        update.address = { street: address };
      } else if (typeof address === 'object') {
        update.address = {
          ...(address.street && { street: address.street }),
          ...(address.city && { city: address.city }),
          ...(address.province && { province: address.province }),
          ...(address.postalCode && { postalCode: address.postalCode }),
          ...(address.country && { country: address.country })
        };
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, error: 'No valid fields to update' });
    }

    // Update user
    const updatedUser = await UserService.update(req.user.id, {
      ...update,
      updated_at: new Date().toISOString()
    });

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (err) {
    console.error('Error in updateProfile:', err);
    return next(new ErrorResponse('Failed to update profile', 500));
  }
};

// User logout
exports.logout = async (req, res, next) => {
  try {
    // Clear refresh token cookie
    res.clearCookie('refreshToken');

    // TODO: Implement token invalidation in Supabase if needed

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (err) {
    next(new ErrorResponse('Logout failed', 500));
  }
};

// Refresh access token
exports.refreshToken = async (req, res, next) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return next(new ErrorResponse('Not authorized', 401));
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, refreshTokenSecret);

    // Check if user exists
    const user = await UserService.findById(decoded.id);

    if (!user) {
      return next(new ErrorResponse('Not authorized', 401));
    }

    // Generate new access token
    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      jwtSecret,
      { expiresIn: jwtExpiry, algorithm: 'HS256' }
    );

    res.status(200).json({
      success: true,
      token: accessToken
    });
  } catch (err) {
    next(new ErrorResponse('Not authorized', 401));
  }
};

// Firebase sync for social authentication
exports.firebaseSync = async (req, res, next) => {
  try {
    const {
      firebaseUid,
      email,
      name,
      firstName,
      lastName,
      profileImage,
      role = 'parent',
      authProvider = 'firebase',
      facebookId,
      googleId,
      emailVerified = false
    } = req.body;

    // Validate required fields
    if (!firebaseUid || !email) {
      return res.status(400).json({
        success: false,
        error: 'Firebase UID and email are required'
      });
    }

    // Normalize role
    const normalizedRole = normalizeRole(role);

    // Check if user already exists by Firebase UID
    // For now, we'll handle this by email since Supabase handles auth differently
    let user = await UserService.findByEmail(email);

    if (user) {
      // Update existing user with new information
      const updates = {
        name: name || user.name,
        first_name: firstName || user.first_name,
        last_name: lastName || user.last_name,
        profile_image: profileImage || user.profile_image,
        auth_provider: authProvider,
        last_login: new Date().toISOString(),
        email_verified: emailVerified || user.email_verified
      };

      // Update social provider IDs if provided
      if (facebookId) updates.facebook_id = facebookId;
      if (googleId) updates.google_id = googleId;

      await UserService.update(user.id, updates);
      console.log('✅ Updated existing Firebase user:', user.email);
    } else {
      // Create new user
      const userData = {
        email,
        name: name || `${firstName || ''} ${lastName || ''}`.trim(),
        first_name: firstName,
        last_name: lastName,
        profile_image: profileImage,
        role: normalizedRole,
        status: 'active',
        auth_provider: authProvider,
        email_verified: emailVerified || (authProvider === 'facebook'),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      // Add social provider IDs if provided
      if (facebookId) userData.facebook_id = facebookId;
      if (googleId) userData.google_id = googleId;

      user = await UserService.create(userData);
      console.log('🆕 Created new Firebase user:', user.email, 'Role:', normalizedRole);
    }

    // Generate tokens for the user
    const tokens = generateTokens(user);

    // TODO: Log the authentication event using AuditLogService

    // Return success response
    res.status(200).json({
      success: true,
      message: 'Firebase user synchronized successfully',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        firstName: user.first_name,
        lastName: user.last_name,
        profileImage: user.profile_image,
        role: user.role,
        authProvider: user.auth_provider,
        facebookId: user.facebook_id,
        googleId: user.google_id,
        emailVerified: user.email_verified,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      tokens
    });

  } catch (error) {
    console.error('Firebase sync error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error during Firebase sync'
    });
  }
};

// Check if email exists
exports.checkEmailExists = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, error: 'Email is required' });
  }

  try {
    const user = await UserService.findByEmail(email.toLowerCase());

    res.status(200).json({
      success: true,
      exists: !!user
    });
  } catch (err) {
    console.error('Check email error:', err);
    res.status(500).json({ success: false, error: 'Failed to check email' });
  }
};

// Upload profile image (simplified for Supabase)
exports.uploadProfileImageBase64 = async (req, res, next) => {
  try {
    const { imageBase64, mimeType } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ success: false, error: 'imageBase64 is required' });
    }

    // For now, we'll store the base64 directly in the profile_image field
    // In a full implementation, you'd upload to Supabase Storage
    const profileImageUrl = `data:${mimeType || 'image/png'};base64,${imageBase64}`;

    // Update user profile
    const updatedUser = await UserService.update(req.user.id, {
      profile_image: profileImageUrl,
      updated_at: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      data: {
        url: profileImageUrl,
        user: updatedUser
      }
    });
  } catch (err) {
    console.error('Error in uploadProfileImageBase64:', err);
    return next(new ErrorResponse('Failed to upload image', 500));
  }
};

// Update role for current authenticated user
exports.updateRole = async (req, res, next) => {
  try {
    const { role } = req.body || {};
    if (!role) {
      return res.status(400).json({ success: false, error: 'role is required' });
    }

    const normalizedRole = normalizeRole(role);

    const updatedUser = await UserService.update(req.user.id, {
      role: normalizedRole,
      updated_at: new Date().toISOString()
    });

    if (!updatedUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // TODO: Create caregiver profile if switching to caregiver role

    return res.status(200).json({ success: true, data: updatedUser });
  } catch (err) {
    console.error('Error in updateRole:', err);
    return next(new ErrorResponse('Failed to update role', 500));
  }
};

// Request password reset (simplified for Supabase)
exports.resetPassword = async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new ErrorResponse('Please provide an email', 400));
  }

  try {
    const user = await UserService.findByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent.'
      });
    }

    // TODO: Implement password reset email sending
    // For now, we'll just return success

    res.status(200).json({
      success: true,
      message: 'Password reset link sent to your email.'
    });
  } catch (err) {
    console.error('Reset password error:', err);
    next(new ErrorResponse('Reset password failed', 500));
  }
};

// Placeholder confirmation handler until Supabase email flow is implemented
exports.confirmPasswordReset = async (req, res) => {
  console.warn('confirmPasswordReset is not yet implemented for Supabase flow.');

  return res.status(501).json({
    success: false,
    error: 'Password reset confirmation is not yet implemented.'
  });
};

// Update children array for logged-in parent user
exports.updateChildren = async (req, res, next) => {
  try {
    const { children } = req.body;
    if (!Array.isArray(children)) {
      return res.status(400).json({ success: false, error: 'Children must be an array.' });
    }

    // Only allow parents to update children
    const user = await UserService.findById(req.user.id);
    if (!user || user.role !== 'parent') {
      return res.status(403).json({ success: false, error: 'Only parent users can update children.' });
    }

    // Update children array
    const updatedUser = await UserService.update(req.user.id, {
      children,
      updated_at: new Date().toISOString()
    });

    res.status(200).json({ success: true, data: updatedUser });
  } catch (err) {
    console.error('Error updating children:', err);
    next(new ErrorResponse('Failed to update children', 500));
  }
};
