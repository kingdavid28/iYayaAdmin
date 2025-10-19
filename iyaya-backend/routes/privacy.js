const express = require('express');
const router = express.Router();
const privacyController = require('../controllers/privacyController');
const { authenticate } = require('../middleware/auth');

// All privacy routes require authentication
router.use(authenticate);

// GET /api/privacy/settings - Get user's privacy settings
router.get('/settings', privacyController.getPrivacySettings);

// PUT /api/privacy/settings - Update user's privacy settings
router.put('/settings', privacyController.updatePrivacySettings);

// POST /api/privacy/request - Request information from another user
router.post('/request', privacyController.requestInformation);

// POST /api/privacy/respond - Respond to an information request
router.post('/respond', privacyController.respondToRequest);

// GET /api/privacy/requests - Get pending information requests
router.get('/requests', privacyController.getPendingRequests);

// GET /api/privacy/notifications - Get privacy notifications
router.get('/notifications', privacyController.getPrivacyNotifications);

// PATCH /api/privacy/notifications/:id/read - Mark notification as read
router.patch('/notifications/:notificationId/read', privacyController.markNotificationAsRead);

// GET /api/privacy/profile/:targetUserId - Get filtered profile data
router.get('/profile/:targetUserId', privacyController.getFilteredProfileData);

module.exports = router;