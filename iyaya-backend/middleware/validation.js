// middleware/validation.js
const { body, validationResult } = require('express-validator');

const validate = (validationType) => {
  const validations = {
    updateProfile: [
      body('name').optional().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters'),
      body('avatar').optional().isURL().withMessage('Avatar must be a valid URL'),
      body('phone').optional().isMobilePhone().withMessage('Phone must be a valid number'),
      body('location').optional().isLength({ max: 100 }).withMessage('Location too long'),
      body('bio').optional().isLength({ max: 500 }).withMessage('Bio too long')
    ]
  };

  return validations[validationType] || [];
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

module.exports = {
  validate,
  handleValidationErrors
};