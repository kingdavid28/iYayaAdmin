const mongoose = require('mongoose');

const DeviceTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['ios', 'android', 'web', 'unknown'],
      default: 'unknown',
    },
  },
  {
    timestamps: true,
  }
);

DeviceTokenSchema.index({ userId: 1, token: 1 }, { unique: true });

module.exports = mongoose.model('DeviceToken', DeviceTokenSchema);
