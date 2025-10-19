const PrivacyRequest = require('../models/PrivacyRequest');
const User = require('../models/User');
const { sendNotification } = require('../services/notificationService');

/**
 * Request information from another user
 * @route POST /api/privacy/request
 * @access Private
 */
exports.requestInformation = async (req, res) => {
  try {
    const { targetUserId, requestedFields, reason } = req.body;
    const requesterId = req.user.id;

    // Validate input
    if (!targetUserId || !requestedFields?.length || !reason) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Check if user is requesting from themselves
    if (targetUserId === requesterId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot request information from yourself' 
      });
    }

    // Check if target user exists
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Create new request
    const request = new PrivacyRequest({
      requesterId,
      targetUserId,
      requestedFields,
      reason,
      status: 'pending'
    });

    await request.save();

    // Send notification to target user
    try {
      await sendNotification({
        userId: targetUserId,
        type: 'info_request',
        title: 'New Information Request',
        message: `You have a new information request from ${req.user.name}`,
        data: { requestId: request._id }
      });
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.status(201).json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Error creating information request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get pending requests for the current user
 * @route GET /api/privacy/requests/pending
 * @access Private
 */
exports.getPendingRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const requests = await PrivacyRequest.find({
      targetUserId: userId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).populate('requesterId', 'name email avatar')
      .sort({ requestedAt: -1 });

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get sent requests by the current user
 * @route GET /api/privacy/requests/sent
 * @access Private
 */
exports.getSentRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const requests = await PrivacyRequest.find({
      requesterId: userId
    }).populate('targetUserId', 'name email avatar')
      .sort({ requestedAt: -1 });

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Respond to an information request
 * @route POST /api/privacy/respond
 * @access Private
 */
exports.respondToRequest = async (req, res) => {
  try {
    const { requestId, approved, sharedFields = [] } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!requestId || approved === undefined) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields' 
      });
    }

    // Find the request
    const request = await PrivacyRequest.findOne({
      _id: requestId,
      targetUserId: userId,
      status: 'pending'
    });

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found or already processed' 
      });
    }

    // Update request status
    request.status = approved ? 'approved' : 'denied';
    request.respondedAt = new Date();
    
    if (approved && sharedFields.length > 0) {
      request.sharedFields = sharedFields;
    }

    await request.save();

    // Send notification to requester
    try {
      const requester = await User.findById(request.requesterId);
      const targetUser = await User.findById(userId);
      
      await sendNotification({
        userId: request.requesterId,
        type: 'info_request_response',
        title: 'Information Request Update',
        message: `${targetUser.name} has ${approved ? 'approved' : 'declined'} your information request`,
        data: { 
          requestId: request._id,
          status: request.status,
          sharedFields: approved ? sharedFields : [] 
        }
      });
    } catch (notifError) {
      console.error('Failed to send notification:', notifError);
      // Don't fail the request if notification fails
    }

    res.json({
      success: true,
      data: request
    });

  } catch (error) {
    console.error('Error responding to request:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get shared information for a specific request
 * @route GET /api/privacy/shared/:requestId
 * @access Private
 */
exports.getSharedInformation = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userId = req.user.id;

    const request = await PrivacyRequest.findOne({
      _id: requestId,
      $or: [
        { requesterId: userId },
        { targetUserId: userId }
      ],
      status: 'approved'
    }).populate('targetUserId', 'name email phone address emergencyContact');

    if (!request) {
      return res.status(404).json({ 
        success: false, 
        message: 'Request not found or not authorized' 
      });
    }

    // Only return the shared fields
    const sharedInfo = {};
    request.sharedFields.forEach(field => {
      if (request.targetUserId[field] !== undefined) {
        sharedInfo[field] = request.targetUserId[field];
      }
    });

    res.json({
      success: true,
      data: sharedInfo
    });

  } catch (error) {
    console.error('Error fetching shared information:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
