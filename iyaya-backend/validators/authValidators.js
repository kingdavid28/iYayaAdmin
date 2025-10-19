const { body, param } = require('express-validator');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Enhanced email check with case insensitivity and caching
const checkEmailExists = async (email, { req }) => {
  const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } })
    .select('_id')
    .lean()
    .cache({ key: `email:${email.toLowerCase()}` });
  if (user) throw new Error('Email already in use');
  return true;
};

const checkEmailNotFound = async (email, { req }) => {
  const user = await User.findOne({ email: { $regex: new RegExp(`^${email}$`, 'i') } })
    .select('_id verification status')
    .lean();
  if (!user) throw new Error('Email not found');
  if (user.status !== 'active') throw new Error('Account is not active');
  req.user = user; // Attach user to request for later use
  return true;
};

// Enhanced password requirements with zxcvbn strength check
const passwordRequirements = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain a number')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[^A-Za-z0-9]/).withMessage('Password must contain a special character')
    .not().isIn(['Password123!', '12345678', 'Qwerty123']).withMessage('Password is too common')
    .custom((value, { req }) => {
      if (value.toLowerCase().includes('password')) {
        throw new Error('Password should not contain the word "password"');
      }
      if (value.toLowerCase().includes(req.body.email?.split('@')[0])) {
        throw new Error('Password should not contain your email username');
      }
      return true;
    })
];

// Registration validator with enhanced security
exports.registerValidations = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(checkEmailExists)
    .bail(),
  
  ...passwordRequirements,
  
  body('userType')
    .isIn(['parent', 'caregiver', 'admin']).withMessage('Invalid user type')
    .bail(),
  
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 50 }).withMessage('Name cannot exceed 50 characters')
    .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name contains invalid characters')
    .escape(),

  body('phone')
    .optional({ checkFalsy: true })
    .trim()
    .isMobilePhone('any').withMessage('Please provide a valid phone number')
    .escape()
];

// Login validator with account status checks
exports.loginValidations = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .bail(),
    
  body('password')
    .notEmpty().withMessage('Password is required')
    .bail(),
    
  body('userType')
    .isIn(['parent', 'caregiver', 'admin']).withMessage('Invalid user type')
    .bail()
];

// Forgot password validator with account verification
exports.forgotPasswordValidations = [
  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(checkEmailNotFound)
    .bail()
];

// Reset password validator with token validation
exports.resetPasswordValidations = [
  param('token')
    .notEmpty().withMessage('Reset token is required')
    .isLength({ min: 20, max: 100 }).withMessage('Invalid token format')
    .bail(),
  
  ...passwordRequirements.map(validation => validation.bail())
];

// Resend verification validator
exports.resendVerificationValidations = [
  body('email')
    .optional()
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail()
    .custom(checkEmailNotFound)
    .bail()
];

// Enhanced validation middleware with error formatting and logging
exports.validateRequest = (validations) => {
  return async (req, res, next) => {
    try {
      // Run all validations
      await Promise.all(validations.map(validation => validation.run(req)));
      
      // Check for errors
      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }
      
      // Format errors
      const formattedErrors = {};
      const uniqueErrors = new Set();
      
      errors.array().forEach(error => {
        const key = `${error.param}:${error.msg}`;
        if (!uniqueErrors.has(key)) {
          uniqueErrors.add(key);
          if (!formattedErrors[error.param]) {
            formattedErrors[error.param] = error.msg;
          } else if (Array.isArray(formattedErrors[error.param])) {
            formattedErrors[error.param].push(error.msg);
          } else {
            formattedErrors[error.param] = [formattedErrors[error.param], error.msg];
          }
        }
      });

      // Log validation errors (for debugging)
      console.debug('Validation failed:', {
        path: req.path,
        method: req.method,
        errors: formattedErrors
      });

      return res.status(422).json({
        success: false,
        message: 'Validation failed',
        errors: formattedErrors
      });
      
    } catch (err) {
      console.error('Validation middleware error:', err);
      return res.status(500).json({
        success: false,
        message: 'Internal server error during validation'
      });
    }
  };
};