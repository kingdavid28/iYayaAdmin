const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    content: String,
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: Date
  },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  }
}, {
  timestamps: true
});

// Add indexes for better performance
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

// Ensure conversations are unique between two users
conversationSchema.index(
  {
    participants: 1
  },
  {
    unique: true,
    partialFilterExpression: {
      $expr: { $eq: [{ $size: '$participants' }, 2] }
    }
  }
);

module.exports = mongoose.model('Conversation', conversationSchema);
