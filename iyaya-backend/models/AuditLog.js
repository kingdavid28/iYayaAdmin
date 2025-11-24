const mongoose = require('mongoose');

const AuditLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  action: {
    type: String,
    required: true,
    enum: [
      'UPDATE_USER_STATUS',
      'UPDATE_BOOKING_STATUS',
      'UPDATE_JOB_STATUS',
      'DELETE_USER',
      'CREATE_USER',
      'LOGIN',
      'LOGOUT',
      'PASSWORD_CHANGE',
      'EMAIL_VERIFICATION'
    ]
  },
  targetId: {
    type: String,
    required: true
  },
  targetType: {
    type: String,
    enum: ['User', 'Booking', 'Job', 'Application'],
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  ip: {
    type: String
  },
  userAgent: {
    type: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ adminId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });

// Virtual for admin details
AuditLogSchema.virtual('admin', {
  ref: 'User',
  localField: 'adminId',
  foreignField: '_id',
  justOne: true
});

// Static method to log admin actions
AuditLogSchema.statics.logAction = async function(adminId, action, targetId, targetType, details = {}, req = null) {
  try {
    const auditLog = new this({
      adminId,
      action,
      targetId,
      targetType,
      details,
      ip: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.get('User-Agent')
    });

    return await auditLog.save();
  } catch (error) {
    console.error('Failed to log audit action:', error);
    // Don't throw - audit logging shouldn't break main functionality
  }
};

// Method to get action description
AuditLogSchema.methods.getDescription = function() {
  const actionDescriptions = {
    'UPDATE_USER_STATUS': `Updated user status`,
    'UPDATE_BOOKING_STATUS': `Updated booking status`,
    'UPDATE_JOB_STATUS': `Updated job status`,
    'DELETE_USER': `Deleted user`,
    'CREATE_USER': `Created user`,
    'LOGIN': `Admin login`,
    'LOGOUT': `Admin logout`,
    'PASSWORD_CHANGE': `Changed password`,
    'EMAIL_VERIFICATION': `Email verification`
  };

  return actionDescriptions[this.action] || this.action;
};

module.exports = mongoose.model('AuditLog', AuditLogSchema);