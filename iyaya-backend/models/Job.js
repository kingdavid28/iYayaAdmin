const mongoose = require('mongoose');

const JobSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: true
  },
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: [true, 'Job description is required'],
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  location: {
    type: String,
    required: true
  },
  date: {
    type: String,
    required: true,
    default: () => new Date().toISOString().split('T')[0]
  },
  startTime: {
    type: String,
    required: true,
    default: '09:00'
  },
  endTime: {
    type: String,
    required: true,
    default: '17:00'
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: [0, 'Hourly rate must be positive']
  },
  numberOfChildren: {
    type: Number,
    default: 1,
    min: [1, 'Must have at least 1 child']
  },
  childrenAges: {
    type: String,
    default: 'Not specified'
  },
  requirements: [{
    type: String,
    trim: true
  }],
  urgent: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'filled', 'cancelled', 'completed'],
    default: 'active'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Job', JobSchema);