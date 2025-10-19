// Graceful handling of missing dependencies
let Joi;
try {
  Joi = require('joi');
} catch (err) {
  console.warn('Joi not installed, using express-validator only');
  Joi = null;
}

const { body, param, query, validationResult } = require('express-validator');
const { regEx } = require('../config/constants');

/**
 * Consolidated Backend Validation System
 * Supports both Joi and express-validator patterns for flexibility
 */

// Custom Joi validators
const customValidators = {
  password: (value, helpers) => {
    if (value.length < 8) {
      return helpers.message('Password must be at least 8 characters');
    }
    if (!value.match(regEx.password)) {
      return helpers.message(
        'Password must contain at least 1 letter, 1 number, and 1 special character'
      );
    }
    return value;
  },

  objectId: (value, helpers) => {
    if (!value.match(regEx.objectId)) {
      return helpers.message('"{{#label}}" must be a valid mongo id');
    }
    return value;
  },

  phoneNumber: (value, helpers) => {
    if (!value.match(/^\+?[\d\s\-\(\)]{10,}$/)) {
      return helpers.message('Invalid phone number format');
    }
    return value;
  },

  dateOfBirth: (value, helpers) => {
    const date = new Date(value);
    const now = new Date();
    const age = now.getFullYear() - date.getFullYear();
    
    if (age < 0 || age > 120) {
      return helpers.message('Invalid date of birth');
    }
    return value;
  }
};

// Joi Schema Definitions (only if Joi is available)
const joiSchemas = Joi ? {
  // Auth schemas
  register: {
    body: Joi.object().keys({
      email: Joi.string().required().email(),
      password: Joi.string().required().custom(customValidators.password),
      name: Joi.string().required().min(2).max(50),
      role: Joi.string().valid('user', 'admin', 'provider', 'client', 'parent', 'caregiver', 'nanny'),
      phoneNumber: Joi.string().optional().custom(customValidators.phoneNumber),
      dateOfBirth: Joi.date().optional().custom(customValidators.dateOfBirth),
    }),
  },

  login: {
    body: Joi.object().keys({
      email: Joi.string().required().email(),
      password: Joi.string().required(),
      userType: Joi.string().optional().valid('client', 'provider', 'admin'),
    }),
  },

  refreshTokens: {
    body: Joi.object().keys({
      refreshToken: Joi.string().required(),
    }),
  },

  forgotPassword: {
    body: Joi.object().keys({
      email: Joi.string().email().required(),
    }),
  },

  resetPassword: {
    query: Joi.object().keys({
      token: Joi.string().required(),
    }),
    body: Joi.object().keys({
      password: Joi.string().required().custom(customValidators.password),
    }),
  },

  verifyEmail: {
    query: Joi.object().keys({
      token: Joi.string().required(),
    }),
  },

  // Profile schemas
  updateProfile: {
    params: Joi.object().keys({
      userId: Joi.string().custom(customValidators.objectId),
    }),
    body: Joi.object().keys({
      name: Joi.string().min(2).max(50),
      phoneNumber: Joi.string().custom(customValidators.phoneNumber),
      dateOfBirth: Joi.date().custom(customValidators.dateOfBirth),
      bio: Joi.string().max(500),
      experience: Joi.number().min(0).max(50),
      hourlyRate: Joi.number().min(0),
      location: Joi.object().keys({
        street: Joi.string(),
        city: Joi.string(),
        state: Joi.string(),
        zipCode: Joi.string(),
        coordinates: Joi.array().items(Joi.number()).length(2),
      }),
    }).min(1),
  },

  // Booking schemas
  createBooking: {
    body: Joi.object().keys({
      caregiverId: Joi.string().required().custom(customValidators.objectId),
      date: Joi.date().required().min('now'),
      startTime: Joi.string().required().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: Joi.string().required().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      children: Joi.array().items(Joi.string()).min(1),
      notes: Joi.string().max(500),
    }),
  },

  updateBooking: {
    params: Joi.object().keys({
      bookingId: Joi.string().custom(customValidators.objectId),
    }),
    body: Joi.object().keys({
      status: Joi.string().valid('pending', 'confirmed', 'cancelled', 'completed'),
      date: Joi.date().min('now'),
      startTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
      notes: Joi.string().max(500),
    }).min(1),
  },

  // Job schemas
  createJob: {
    body: Joi.object().keys({
      title: Joi.string().required().min(5).max(100),
      description: Joi.string().required().min(20).max(1000),
      location: Joi.object().required().keys({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        zipCode: Joi.string().required(),
      }),
      hourlyRate: Joi.number().required().min(0),
      startDate: Joi.date().required().min('now'),
      endDate: Joi.date().required().min(Joi.ref('startDate')),
      requirements: Joi.array().items(Joi.string()),
      isRecurring: Joi.boolean(),
      recurringDays: Joi.when('isRecurring', {
        is: true,
        then: Joi.array().items(Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')).min(1),
        otherwise: Joi.optional(),
      }),
    }),
  },
} : {};

// Express-validator Schema Definitions
const expressValidatorSchemas = {
  register: [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[0-9]/)
      .withMessage('Password must contain a number')
      .matches(/[a-zA-Z]/)
      .withMessage('Password must contain a letter')
      .matches(/[!@#$%^&*(),.?":{}|<>]/)
      .withMessage('Password must contain a special character'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('role')
      .optional()
      .isIn(['user', 'admin', 'provider', 'client', 'parent', 'caregiver', 'nanny'])
      .withMessage('Invalid user role'),
  ],

  login: [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password is required'),
    body('userType')
      .optional()
      .isIn(['client', 'provider', 'admin'])
      .withMessage('Invalid user type'),
  ],

  refreshToken: [
    body('refreshToken')
      .notEmpty()
      .withMessage('Refresh token is required')
      .isJWT()
      .withMessage('Invalid refresh token format'),
  ],

  updateProfile: [
    param('userId').isMongoId().withMessage('Invalid user ID'),
    body('name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage('Name must be between 2 and 50 characters'),
    body('phoneNumber')
      .optional()
      .matches(/^\+?[\d\s\-\(\)]{10,}$/)
      .withMessage('Invalid phone number format'),
    body('bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
  ],
};

// Joi validation middleware factory
const validateJoi = (schemaName) => {
  if (!Joi) {
    console.warn(`Joi validation requested for '${schemaName}' but Joi is not available`);
    return (req, res, next) => next();
  }
  
  const schema = joiSchemas[schemaName];
  if (!schema) {
    return (req, res, next) => next();
  }

  return async (req, res, next) => {
    try {
      const options = { abortEarly: false, stripUnknown: true };
      
      if (schema.params) {
        req.params = await schema.params.validateAsync(req.params, options);
      }
      if (schema.query) {
        req.query = await schema.query.validateAsync(req.query, options);
      }
      if (schema.body) {
        req.body = await schema.body.validateAsync(req.body, options);
      }
      
      next();
    } catch (err) {
      const details = err?.details?.map((d) => ({
        field: d.path.join('.'),
        message: d.message,
        value: d.context?.value,
      })) || [{ message: err.message }];
      
      res.status(400).json({
        success: false,
        error: 'Validation error',
        code: 'VALIDATION_ERROR',
        details,
      });
    }
  };
};

// Express-validator validation middleware factory
const validateExpressValidator = (schemaName) => {
  const schema = expressValidatorSchemas[schemaName];
  if (!schema) {
    throw new Error(`Validation schema '${schemaName}' not found`);
  }

  return [
    ...schema,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array().map(err => ({
            field: err.param,
            message: err.msg,
            location: err.location,
            value: err.value,
          })),
        });
      }
      next();
    },
  ];
};

// Generic validation middleware (defaults to Joi)
const validate = (schemaName, type = 'joi') => {
  if (type === 'express-validator') {
    return validateExpressValidator(schemaName);
  }
  return validateJoi(schemaName);
};

// Validation result handler for express-validator
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        location: err.location,
        value: err.value,
      })),
    });
  }
  next();
};

// Utility functions for custom validation
const sanitizeInput = {
  email: (email) => email?.toLowerCase().trim(),
  name: (name) => name?.trim().replace(/\s+/g, ' '),
  phoneNumber: (phone) => phone?.replace(/\D/g, ''),
};

module.exports = {
  // Main validation functions
  validate,
  validateJoi,
  validateExpressValidator,
  handleValidationErrors,
  
  // Schema objects for direct use
  joiSchemas,
  expressValidatorSchemas,
  customValidators,
  
  // Utility functions
  sanitizeInput,
  
  // Legacy exports for backward compatibility
  register: joiSchemas.register,
  login: joiSchemas.login,
  refreshTokens: joiSchemas.refreshTokens,
  forgotPassword: joiSchemas.forgotPassword,
  resetPassword: joiSchemas.resetPassword,
  verifyEmail: joiSchemas.verifyEmail,
  
  // Express-validator specific exports
  body,
  param,
  query,
  validationResult,
};
