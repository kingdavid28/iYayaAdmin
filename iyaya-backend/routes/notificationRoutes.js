const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  getNotifications,
  markAsRead,
  markAllAsRead
} = require('../controllers/notificationController');

// All notification routes require authentication
router.use(authenticate);

// Get all notifications for the current user
router.get('/', getNotifications);

// Mark a specific notification as read
router.patch('/:notificationId/read', markAsRead);

// Mark all notifications as read
router.patch('/read-all', markAllAsRead);

module.exports = router;
