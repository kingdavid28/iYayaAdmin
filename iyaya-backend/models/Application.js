const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    caregiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    coverLetter: { type: String },
    proposedRate: { type: Number },
    message: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'rejected', 'shortlisted', 'completed'], default: 'pending' },
    reviewedAt: { type: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'createdAt', updatedAt: 'updatedAt' } }
);

module.exports = mongoose.model('Application', ApplicationSchema);
