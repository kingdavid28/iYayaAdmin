const { validationResult } = require('express-validator');
const Privacy = require('../models/Privacy');
const PrivacyRequest = require('../models/PrivacyRequest');
const PrivacyNotification = require('../models/PrivacyNotification');
const User = require('../models/User');
const { process: processError } = require('../utils/errorHandler');
const logger = require('../utils/logger');

class PrivacyController {
  // Get user's privacy settings
  async getPrivacySettings(req, res) {
    try {
      const userId = req.user.id;
      
      let privacySettings = await Privacy.findOne({ userId });
      
      if (!privacySettings) {
        // Create default privacy settings
        privacySettings = new Privacy({
          userId,
          sharePhone: false,
          shareAddress: false,
          shareEmergencyContact: false,
          shareChildMedicalInfo: false,
          shareChildAllergies: false,
          shareChildBehaviorNotes: false,
          shareFinancialInfo: false,
          autoApproveBasicInfo: true,
        });
        await privacySettings.save();
      }

      res.json({
        success: true,
        data: privacySettings
      });
    } catch (error) {
      logger.error('Error getting privacy settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get privacy settings',
        error: error.message
      });
    }
  }

  // Update user's privacy settings
  async updatePrivacySettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const updateData = req.body;

      const privacySettings = await Privacy.findOneAndUpdate(
        { userId },
        { ...updateData, updatedAt: new Date() },
        { new: true, upsert: true }
      );

      // Log privacy setting changes
      logger.info(`Privacy settings updated for user ${userId}:`, updateData);

      res.json({
        success: true,
        data: privacySettings,
        message: 'Privacy settings updated successfully'
      });
    } catch (error) {
      logger.error('Error updating privacy settings:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update privacy settings',
        error: error.message
      });
    }
  }

  // Request information from another user
  async requestInformation(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const requesterId = req.user.uid;
      const { targetUserId, requestedFields, reason } = req.body;

      // Check if target user exists
      const targetUser = await User.findOne({ uid: targetUserId });
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'Target user not found'
        });
      }

      // Check if there's already a pending request
      const existingRequest = await PrivacyRequest.findOne({
        requesterId,
        targetUserId,
        status: 'pending'
      });

      if (existingRequest) {
        return res.status(400).json({
          success: false,
          message: 'You already have a pending request for this user'
        });
      }

      // Create new privacy request
      const privacyRequest = new PrivacyRequest({
        requesterId,
        targetUserId,
        requestedFields,
        reason,
        status: 'pending',
        requestedAt: new Date()
      });

      await privacyRequest.save();

      // Create notification for target user
      const notification = new PrivacyNotification({
        userId: targetUserId,
        type: 'info_request',
        message: `${req.user.name || 'Someone'} has requested access to your information`,
        data: {
          requestId: privacyRequest._id,
          requesterId,
          requestedFields
        },
        read: false,
        createdAt: new Date()
      });

      await notification.save();

      logger.info(`Information request created: ${requesterId} -> ${targetUserId}`);

      res.json({
        success: true,
        data: privacyRequest,
        message: 'Information request sent successfully'
      });
    } catch (error) {
      logger.error('Error creating information request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create information request',
        error: error.message
      });
    }
  }

  // Respond to an information request
  async respondToRequest(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { requestId, approved, sharedFields = [] } = req.body;

      const privacyRequest = await PrivacyRequest.findOne({
        _id: requestId,
        targetUserId: userId,
        status: 'pending'
      });

      if (!privacyRequest) {
        return res.status(404).json({
          success: false,
          message: 'Privacy request not found or already processed'
        });
      }

      // Update request status
      privacyRequest.status = approved ? 'approved' : 'denied';
      privacyRequest.sharedFields = approved ? sharedFields : [];
      privacyRequest.respondedAt = new Date();
      
      await privacyRequest.save();

      // Create notification for requester
      const notification = new PrivacyNotification({
        userId: privacyRequest.requesterId,
        type: 'info_request_response',
        message: approved 
          ? 'Your information request has been approved'
          : 'Your information request has been denied',
        data: {
          requestId: privacyRequest._id,
          approved,
          sharedFields
        },
        read: false,
        createdAt: new Date()
      });

      await notification.save();

      logger.info(`Information request ${approved ? 'approved' : 'denied'}: ${requestId}`);

      res.json({
        success: true,
        data: privacyRequest,
        message: `Request ${approved ? 'approved' : 'denied'} successfully`
      });
    } catch (error) {
      logger.error('Error responding to information request:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to respond to information request',
        error: error.message
      });
    }
  }

  // Get pending information requests for current user
  async getPendingRequests(req, res) {
    try {
      const userId = req.user.id;

      const pendingRequests = await PrivacyRequest.find({
        targetUserId: userId,
        status: 'pending'
      })
      .populate('requesterId', 'name email profileImage')
      .sort({ requestedAt: -1 });

      res.json({
        success: true,
        data: pendingRequests
      });
    } catch (error) {
      logger.error('Error getting pending requests:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get pending requests',
        error: error.message
      });
    }
  }

  // Get privacy notifications for current user
  async getPrivacyNotifications(req, res) {
    try {
      const userId = req.user.id;
      const { limit = 50, offset = 0 } = req.query;

      const notifications = await PrivacyNotification.find({ userId })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(offset));

      const unreadCount = await PrivacyNotification.countDocuments({
        userId,
        read: false
      });

      res.json({
        success: true,
        data: notifications,
        unreadCount
      });
    } catch (error) {
      logger.error('Error getting privacy notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get privacy notifications',
        error: error.message
      });
    }
  }

  // Mark notification as read
  async markNotificationAsRead(req, res) {
    try {
      const userId = req.user.id;
      const { notificationId } = req.params;

      const notification = await PrivacyNotification.findOneAndUpdate(
        { _id: notificationId, userId },
        { read: true, readAt: new Date() },
        { new: true }
      );

      if (!notification) {
        return res.status(404).json({
          success: false,
          message: 'Notification not found'
        });
      }

      res.json({
        success: true,
        data: notification,
        message: 'Notification marked as read'
      });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read',
        error: error.message
      });
    }
  }

  // Get filtered profile data based on privacy settings
  async getFilteredProfileData(req, res) {
    try {
      const { targetUserId } = req.params;
      const viewerId = req.user.uid;

      // Get target user's profile
      const targetUser = await User.findOne({ uid: targetUserId });
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Get target user's privacy settings
      const privacySettings = await Privacy.findOne({ userId: targetUserId });
      
      // Get approved information requests
      const approvedRequest = await PrivacyRequest.findOne({
        requesterId: viewerId,
        targetUserId,
        status: 'approved'
      });

      // Filter data based on privacy settings and approved requests
      const filteredData = this.filterUserData(
        targetUser.toObject(),
        privacySettings,
        approvedRequest?.sharedFields || []
      );

      res.json({
        success: true,
        data: filteredData
      });
    } catch (error) {
      logger.error('Error getting filtered profile data:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get profile data',
        error: error.message
      });
    }
  }

  // Helper method to filter user data based on privacy settings
  filterUserData(userData, privacySettings, approvedFields = []) {
    const publicFields = ['name', 'profileImage', 'location', 'email'];
    const privateFields = {
      phone: 'sharePhone',
      address: 'shareAddress',
      emergencyContact: 'shareEmergencyContact',
      childMedicalInfo: 'shareChildMedicalInfo',
      childAllergies: 'shareChildAllergies',
      childBehaviorNotes: 'shareChildBehaviorNotes',
      financialInfo: 'shareFinancialInfo'
    };

    const filteredData = {};

    // Always include public fields
    publicFields.forEach(field => {
      if (userData[field] !== undefined) {
        filteredData[field] = userData[field];
      }
    });

    // Include private fields based on settings or approved requests
    Object.keys(privateFields).forEach(field => {
      const settingKey = privateFields[field];
      
      if (userData[field] !== undefined) {
        if (approvedFields.includes(field) || 
            (privacySettings && privacySettings[settingKey])) {
          filteredData[field] = userData[field];
        } else {
          filteredData[field] = '[Private - Request Access]';
        }
      }
    });

    return filteredData;
  }
}

module.exports = new PrivacyController();
