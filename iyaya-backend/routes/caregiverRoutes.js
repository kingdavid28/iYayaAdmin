const express = require('express');
const router = express.Router();
const caregiverController = require('../controllers/caregiverController');
const { authenticate, authorize } = require('../middleware/auth');
const { checkUserType } = require('../middleware/authorization');
const { 
  searchCaregiversValidator,
  caregiverIdValidator,
  updateCaregiverValidator 
} = require('../validators/caregiverValidators');
const rateLimit = require('express-rate-limit');

// Enhanced rate limiting configuration
const caregiverLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: {
    success: false,
    error: 'Too many requests, please try again later',
    statusCode: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for certain endpoints if needed
    return req.path === '/health-check';
  }
});

// Verify controller methods exist with better error handling
const requiredMethods = [
  'searchCaregivers',
  'getCaregiverDetails',
  'updateCaregiverProfile',
  'getCaregiverProfile',
  'uploadDocuments',
  'refreshToken',
  'requestBackgroundCheck'
];

console.log('🔍 Verifying caregiver controller methods...');
requiredMethods.forEach(method => {
  if (typeof caregiverController[method] !== 'function') {
    const error = new Error(`Caregiver controller missing method: ${method}`);
    console.error(`❌ Critical error: ${error.message}`);
    throw error;
  }
  console.log(`✅ ${method} exists and is a function`);
});

// Apply rate limiting to all caregiver routes
router.use(caregiverLimiter);

// Add request logging middleware for debugging
router.use((req, res, next) => {
  console.log('📝 Caregiver route request:', {
    method: req.method,
    url: req.originalUrl,
    path: req.path,
    hasBody: !!req.body,
    bodySize: req.body ? JSON.stringify(req.body).length : 0,
    contentType: req.headers['content-type'],
    userAgent: req.headers['user-agent']?.substring(0, 50)
  });
  next();
});

/**
 * @swagger
 * tags:
 *   name: Caregivers
 *   description: Service provider management endpoints
 *   version: 1.0.0
 */

// =====================
// AUTHENTICATED ROUTES (placed BEFORE '/:id' to avoid conflicts)
// =====================
router.get(
  '/profile',
  authenticate,
  caregiverController.getCaregiverProfile
);

router.post(
  '/profile',
  authenticate,
  checkUserType('caregiver'),
  updateCaregiverValidator,
  caregiverController.updateCaregiverProfile
);

router.put(
  '/profile',
  authenticate,
  // checkUserType('caregiver'), // Temporarily disabled for debugging
  // updateCaregiverValidator, // Temporarily disabled for debugging
  (req, res, next) => {
    console.log('🚀 About to call updateCaregiverProfile controller');
    next();
  },
  caregiverController.updateCaregiverProfile,
  (err, req, res, next) => {
    console.log('❌ Error caught in caregiver route:', {
      message: err.message,
      name: err.name,
      status: err.status
    });
    next(err);
  }
);

router.post(
  '/documents',
  authenticate,
  checkUserType('caregiver'),
  caregiverController.uploadDocuments
);

router.post(
  '/refresh-token',
  authenticate,
  caregiverController.refreshToken
);

router.post(
  '/background-check',
  authenticate,
  checkUserType('caregiver'),
  caregiverController.requestBackgroundCheck
);

// =====================
// PUBLIC ROUTES
// =====================
// List/search caregivers
router.get('/', caregiverController.searchCaregivers);

// Get caregiver details by id
router.get('/:id', caregiverController.getCaregiverDetails);

// Health check endpoint
router.get('/health-check', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Caregiver routes are healthy',
    timestamp: new Date()
  });
});

// Test endpoint without auth
router.get('/test-profile/:email', async (req, res) => {
  try {
    const User = require('../models/User');
    const Caregiver = require('../models/Caregiver');
    
    const user = await User.findOne({ email: req.params.email });
    if (!user) {
      return res.json({ success: false, error: 'User not found' });
    }
    
    const caregiver = await Caregiver.findOne({ userId: user._id })
      .populate('userId', 'name email phone')
      .lean();
    
    res.json({ 
      success: true, 
      user: { id: user._id, email: user.email, role: user.role },
      caregiver: caregiver || 'Not found'
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Test endpoint for debugging
router.put('/test', (req, res) => {
  console.log('🧪 Test endpoint hit:', {
    method: req.method,
    body: req.body,
    headers: req.headers
  });
  res.json({ success: true, message: 'Test endpoint working', receivedData: req.body });
});

// Test update endpoint
router.put('/test-update', authenticate, caregiverController.testUpdate);

console.log('\n🚀 Caregiver Routes Successfully Registered:');
console.log('GET    /              - Search caregivers');
console.log('GET    /:id           - Get caregiver details');
console.log('GET    /profile       - Get authenticated caregiver profile');
console.log('PUT    /profile       - Update caregiver profile');
console.log('POST   /documents     - Upload documents');
console.log('POST   /refresh-token - Refresh auth token');
console.log('POST   /background-check - Request background check');
console.log('GET    /health-check  - Service health check');

module.exports = router;