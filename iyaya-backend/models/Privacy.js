const mongoose = require('mongoose');

const privacySchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sharePhone: {
    type: Boolean,
    default: false
  },
  shareAddress: {
    type: Boolean,
    default: false
  },
  shareEmergencyContact: {
    type: Boolean,
    default: false
  },
  shareChildMedicalInfo: {
    type: Boolean,
    default: false
  },
  shareChildAllergies: {
    type: Boolean,
    default: false
  },
  shareChildBehaviorNotes: {
    type: Boolean,
    default: false
  },
  shareFinancialInfo: {
    type: Boolean,
    default: false
  },
  autoApproveBasicInfo: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
privacySchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Index for efficient queries
privacySchema.index({ userId: 1 });

module.exports = mongoose.model('Privacy', privacySchema);
