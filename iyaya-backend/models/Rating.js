const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  rater: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ratee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  review: {
    type: String,
    maxlength: 500
  },
  type: {
    type: String,
    enum: ['caregiver', 'parent'],
    required: true
  }
}, {
  timestamps: true
});

// Add indexes for better performance
ratingSchema.index({ ratee: 1, type: 1, createdAt: -1 });
ratingSchema.index({ booking: 1, rater: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Rating', ratingSchema);
