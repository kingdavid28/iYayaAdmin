const mongoose = require('mongoose');

const childSchema = new mongoose.Schema({
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  age: {
    type: Number,
    required: true,
    min: 0,
    max: 18
  },
  allergies: {
    type: String,
    default: ''
  },
  preferences: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

// Indexes for better query performance
childSchema.index({ parentId: 1 });

// Unique compound index to prevent duplicate children with same name for same parent
childSchema.index({ parentId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Child', childSchema);