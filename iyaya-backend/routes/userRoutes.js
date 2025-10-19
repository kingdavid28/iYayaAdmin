const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const deviceTokenController = require('../controllers/deviceTokenController');

// GET /api/users/profile - Get current user profile
router.get('/profile', userController.getCurrentUserProfile);

// GET /api/users/:id - Get user profile by ID
router.get('/:id', userController.getUserProfile);

// POST /api/users/device-token - Register or refresh device token
router.post('/device-token', deviceTokenController.upsertDeviceToken);

// DELETE /api/users/device-token - Remove device token(s)
router.delete('/device-token', deviceTokenController.removeDeviceToken);

// PUT /api/users/profile - Update current user profile
router.put('/profile', userController.updateProfile);

// GET /api/users - Get users list (with search and filters)
router.get('/', userController.getUsers);

// GET /api/users/caregivers - Get caregivers list
router.get('/caregivers', userController.getCaregivers);

// GET /api/users/families - Get families list
router.get('/families', userController.getFamilies);

module.exports = router;