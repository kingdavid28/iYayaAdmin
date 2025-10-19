const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  clientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  caregiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String,
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  hourlyRate: {
    type: Number,
    required: true
  },
  totalCost: {
    type: Number,
    required: true
  },
  children: [{
    name: String,
    age: Number,
    preferences: String,
    allergies: String
  }],
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentProof: {
    type: String
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', BookingSchema);