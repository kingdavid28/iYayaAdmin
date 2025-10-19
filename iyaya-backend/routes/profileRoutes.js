const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');

// All profile routes require authentication
router.use(authenticate);

// GET /api/profile - Get user profile
router.get('/', profileController.getProfile);

// PUT /api/profile - Update user profile
router.put('/', profileController.updateProfile);

// POST /api/profile/image - Update profile image
router.post('/image', profileController.updateProfileImage);

// GET /api/profile/children - Get children (for parents)
router.get('/children', profileController.getChildren);

// PUT /api/profile/children - Update children (for parents)
router.put('/children', profileController.updateChildren);

// GET /api/profile/availability - Get caregiver availability
router.get('/availability', profileController.getAvailability);

// PUT /api/profile/availability - Update caregiver availability
router.put('/availability', profileController.updateAvailability);

module.exports = router;