// validators/caregiverValidators.js
const { body, param, query, validationResult } = require('express-validator');
const { isValidObjectId } = require('mongoose');

// Reusable validation middleware with enhanced error reporting
const validate = (validations) => {
  return async (req, res, next) => {
    console.log('🔍 Validating request body:', {
      url: req.originalUrl,
      method: req.method,
      bodyKeys: Object.keys(req.body || {}),
      bodySize: JSON.stringify(req.body || {}).length
    });

    await Promise.all(validations.map(validation => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      console.log('✅ Validation passed');
      return next();
    }

    console.log('❌ Validation failed:', errors.array());
    res.status(400).json({ 
      success: false,
      error: 'Validation failed',
      details: errors.array(),
      statusCode: 400
    });
  };
};

// Search caregivers validation
const searchCaregiversValidator = validate([
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Search term must be less than 100 characters'),
  
  query('location')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Location must be less than 100 characters'),
  
  query('serviceType')
    .optional()
    .trim()
    .isLength({ max: 50 }).withMessage('Service type must be less than 50 characters'),
  
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt()
]);

// Caregiver ID validation
const caregiverIdValidator = validate([
  param('id')
    .trim()
    .notEmpty().withMessage('Caregiver ID is required')
    .custom((value) => {
      if (!isValidObjectId(value)) {
        throw new Error('Invalid caregiver ID format');
      }
      return true;
    })
]);

// Update caregiver profile validation - More permissive
const updateCaregiverValidator = validate([
  body('name')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      if (typeof value !== 'string') return false;
      const trimmed = value.trim();
      return trimmed.length >= 2 && trimmed.length <= 100;
    }).withMessage('Name must be between 2-100 characters'),
  
  body('email')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      if (typeof value !== 'string') return false;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }).withMessage('Invalid email format'),
  
  body('phone')
    .optional()
    .custom((value) => {
      if (!value || value === '') return true; // Allow empty
      if (typeof value !== 'string') return false;
      // More flexible phone validation
      return /^[\+]?[0-9\s\-\(\)]{7,20}$/.test(value);
    }).withMessage('Invalid phone number format'),
  
  body('bio')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      if (typeof value !== 'string') return false;
      return value.length <= 2000;
    }).withMessage('Bio must be less than 2000 characters'),
  
  body('skills')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      return Array.isArray(value);
    }).withMessage('Skills must be an array'),
  
  body('certifications')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      return Array.isArray(value);
    }).withMessage('Certifications must be an array'),
  
  body('ageCareRanges')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      return Array.isArray(value);
    }).withMessage('Age care ranges must be an array'),
  
  body('hourlyRate')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true; // Allow empty
      const num = parseFloat(value);
      return !isNaN(num) && num >= 0;
    }).withMessage('Hourly rate must be a valid number'),
  
  body('experience')
    .optional()
    .custom((value) => {
      if (!value && value !== 0) return true; // Allow empty but not zero
      if (typeof value === 'number') return value >= 0; // Allow number (total months)
      if (typeof value === 'object' && value !== null) {
        return (typeof value.years === 'number' || typeof value.years === 'undefined') &&
               (typeof value.months === 'number' || typeof value.months === 'undefined');
      }
      return false;
    }).withMessage('Experience must be a number or object with years/months'),
  
  body('address')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      return typeof value === 'object' && value !== null;
    }).withMessage('Address must be an object'),
  
  body('profileImage')
    .optional()
    .custom((value) => {
      if (!value) return true; // Allow empty
      if (typeof value !== 'string') return false;
      // Allow URLs, base64 data URLs, or relative paths
      return value.length > 0;
    }).withMessage('Profile image must be a valid string')
]);

module.exports = {
  searchCaregiversValidator,
  caregiverIdValidator,
  updateCaregiverValidator
};