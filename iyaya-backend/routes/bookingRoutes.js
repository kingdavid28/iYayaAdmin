const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { body, param } = require('express-validator');
const bookingController = require('../controllers/bookingController');
const bookingControllerNew = require('../controllers/bookingController');
const rateLimit = require('express-rate-limit');

// All booking routes require authentication
router.use(authenticate);

// Rate limiting for booking creation (5 bookings per hour per user)
const bookingLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: {
    error: 'Too many booking attempts. Please try again later.'
  },
  keyGenerator: (req) => {
    return req.user.id; // Limit by user ID
  }
});

// Input sanitization middleware
const sanitizeInput = [
  body('address').escape().trim(),
  body('contact').escape().trim(),
  body('feedback').optional().escape().trim()
];

// Custom validation for date (not in past)
const validateDateNotInPast = (value) => {
  const selectedDate = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to compare dates only
  
  if (selectedDate < today) {
    throw new Error('Booking date cannot be in the past');
  }
  return true;
};

// Custom validation for time logic
const validateTimeLogic = (req) => {
  const { startTime, endTime } = req.body;
  
  if (startTime && endTime) {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    
    const startTotalMinutes = startHours * 60 + startMinutes;
    const endTotalMinutes = endHours * 60 + endMinutes;
    
    if (endTotalMinutes <= startTotalMinutes) {
      throw new Error('End time must be after start time');
    }
    
    // Optional: Validate minimum booking duration (e.g., at least 1 hour)
    const durationMinutes = endTotalMinutes - startTotalMinutes;
    if (durationMinutes < 60) {
      throw new Error('Minimum booking duration is 1 hour');
    }
  }
  
  return true;
};

// Validation middleware
const validateBooking = [
  body('caregiverId').isMongoId().withMessage('Valid caregiver ID is required'),
  body('date')
    .isISO8601().withMessage('Valid date is required')
    .custom(validateDateNotInPast),
  body('startTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid start time is required (HH:MM)'),
  body('endTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid end time is required (HH:MM)'),
  body('children')
    .isArray({ min: 1 }).withMessage('At least one child is required')
    .custom((children) => {
      if (!children.every(child => child._id || child.name)) {
        throw new Error('Each child must have valid information');
      }
      return true;
    }),
  body('address')
    .notEmpty().withMessage('Address is required')
    .isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  body('contact')
    .notEmpty().withMessage('Contact information is required')
    .isLength({ max: 100 }).withMessage('Contact information must be less than 100 characters'),
  body('hourlyRate')
    .isNumeric().withMessage('Hourly rate must be a number')
    .isFloat({ min: 0 }).withMessage('Hourly rate must be positive'),
  body('totalCost')
    .optional()
    .isNumeric().withMessage('Total cost must be a number')
    .isFloat({ min: 0 }).withMessage('Total cost must be positive'),
  body().custom(validateTimeLogic)
];

const validateBookingId = [
  param('id').isMongoId().withMessage('Valid booking ID is required')
];

const validateStatusUpdate = [
  param('id').isMongoId().withMessage('Valid booking ID is required'),
  body('status')
    .isIn(['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'])
    .withMessage('Invalid status'),
  body('feedback')
    .optional()
    .isLength({ max: 500 }).withMessage('Feedback must be less than 500 characters')
];

const validatePaymentProof = [
  param('id').isMongoId().withMessage('Valid booking ID is required'),
  body('imageBase64').notEmpty().withMessage('Payment proof image is required'),
  body('mimeType')
    .optional()
    .isIn(['image/jpeg', 'image/png', 'image/jpg'])
    .withMessage('Invalid image type. Only JPEG, PNG, and JPG are allowed.')
];

// Routes - in correct order (specific before parameterized)
router.post('/', bookingLimiter, sanitizeInput, validateBooking, bookingControllerNew.createBooking);
router.get('/my', bookingControllerNew.getMyBookings);
router.get('/:id', validateBookingId, bookingController.getBookingById);
router.patch('/:id/status', validateBookingId, sanitizeInput, validateStatusUpdate, bookingController.updateBookingStatus);
router.post('/:id/payment-proof', validateBookingId, validatePaymentProof, bookingControllerNew.uploadPaymentProof);
router.delete('/:id', validateBookingId, bookingController.cancelBooking);

module.exports = router;