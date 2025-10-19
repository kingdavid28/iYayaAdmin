const mongoose = require('mongoose');

const privacyRequestSchema = new mongoose.Schema({
  requesterId: {
    type: String,
    required: true,
    index: true
  },
  targetUserId: {
    type: String,
    required: true,
    index: true
  },
  requestedFields: [{
    type: String,
    required: true
  }],
  reason: {
    type: String,
    required: true,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'denied', 'expired'],
    default: 'pending',
    index: true
  },
  sharedFields: [{
    type: String
  }],
  requestedAt: {
    type: Date,
    default: Date.now
  },
  respondedAt: {
    type: Date
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  }
});

// Compound indexes for efficient queries
privacyRequestSchema.index({ requesterId: 1, targetUserId: 1 });
privacyRequestSchema.index({ targetUserId: 1, status: 1 });
privacyRequestSchema.index({ requesterId: 1, status: 1 });

// TTL index to automatically remove expired requests
privacyRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual to populate requester information
privacyRequestSchema.virtual('requester', {
  ref: 'User',
  localField: 'requesterId',
  foreignField: 'uid',
  justOne: true
});

// Virtual to populate target user information
privacyRequestSchema.virtual('targetUser', {
  ref: 'User',
  localField: 'targetUserId',
  foreignField: 'uid',
  justOne: true
});

// Ensure virtual fields are serialized
privacyRequestSchema.set('toJSON', { virtuals: true });
privacyRequestSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('PrivacyRequest', privacyRequestSchema);
