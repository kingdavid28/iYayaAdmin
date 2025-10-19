const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  requestInformation,
  getPendingRequests,
  getSentRequests,
  respondToRequest,
  getSharedInformation
} = require('../controllers/privacyRequestController');

// Request information from another user
router.post('/request', protect, requestInformation);

// Get pending requests for the current user
router.get('/requests/pending', protect, getPendingRequests);

// Get sent requests by the current user
router.get('/requests/sent', protect, getSentRequests);

// Respond to an information request
router.post('/respond', protect, respondToRequest);

// Get shared information for a specific request
router.get('/shared/:requestId', protect, getSharedInformation);

module.exports = router;
