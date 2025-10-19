const mongoose = require('mongoose');

const privacyNotificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: [
      'info_request',
      'info_request_response',
      'privacy_setting_changed',
      'data_access_granted',
      'data_access_revoked'
    ],
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound indexes for efficient queries
privacyNotificationSchema.index({ userId: 1, read: 1 });
privacyNotificationSchema.index({ userId: 1, createdAt: -1 });
privacyNotificationSchema.index({ userId: 1, type: 1 });

// TTL index to automatically remove old notifications after 90 days
privacyNotificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('PrivacyNotification', privacyNotificationSchema);
