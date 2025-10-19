const mongoose = require('mongoose');

const CaregiverSchema = new mongoose.Schema({
  caregiverId: {
    type: String,
    unique: true,
    required: true,
    index: true
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  // Basic Information
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  bio: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  profileImage: {
    type: String,
    trim: true
  },
  // Contact/Location - Support both string and object formats
  address: {
    type: mongoose.Schema.Types.Mixed,
    trim: true
  },
  location: {
    type: String,
    trim: true,
    maxlength: 100
  },
  // Professional Details
  skills: [{ 
    type: String,
    trim: true
  }], // ["Childcare", "Cleaning", "Cooking"]
  experience: {
    type: mongoose.Schema.Types.Mixed
  },
  hourlyRate: { 
    type: Number,
    min: 0
  },
  education: {
    type: String,
    trim: true,
    maxlength: 500
  },
  languages: [{
    type: String,
    trim: true
  }],
  certifications: [{
    name: {
      type: String,
      required: true,
      trim: true
    },
    issuedBy: {
      type: String,
      trim: true
    },
    issuedDate: {
      type: Date
    },
    expiryDate: {
      type: Date
    },
    verified: {
      type: Boolean,
      default: false
    },
    documentUrl: {
      type: String,
      trim: true
    }
  }],
  // Age care specializations
  ageCareRanges: [{
    type: String,
    enum: ['INFANT', 'TODDLER', 'PRESCHOOL', 'SCHOOL_AGE', 'TEEN']
  }],
  // Enhanced Availability System - Simplified to prevent CastError
  availability: {
    type: mongoose.Schema.Types.Mixed
  },
  rating: { 
    type: Number, 
    min: 1, 
    max: 5, 
    default: 1 
  },
  reviews: [{ 
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User',
      required: true
    },
    rating: { 
      type: Number, 
      min: 1, 
      max: 5,
      required: true
    },
    comment: {
      type: String,
      trim: true,
      maxlength: 500
    },
    createdAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  // Enhanced Background Check System
  backgroundCheck: {
    status: { 
      type: String, 
      enum: ['not_started', 'pending', 'in_progress', 'approved', 'rejected', 'expired'],
      default: 'not_started'
    },
    provider: {
      type: String,
      enum: ['internal', 'third_party_service', 'government'],
      default: 'internal'
    },
    requestedAt: Date,
    completedAt: Date,
    verifiedAt: Date,
    expiryDate: Date,
    verifiedBy: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'User' 
    },
    reportId: String,
    notes: String,
    checkTypes: [{
      type: String,
      enum: ['criminal', 'identity', 'employment', 'education', 'reference']
    }]
  },
  // Profile Verification System
  verification: {
    profileComplete: {
      type: Boolean,
      default: false
    },
    identityVerified: {
      type: Boolean,
      default: false
    },
    certificationsVerified: {
      type: Boolean,
      default: false
    },
    referencesVerified: {
      type: Boolean,
      default: false
    },
    trustScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    badges: [{
      type: String,
      enum: ['verified_identity', 'background_checked', 'certified_caregiver', 'experienced_professional', 'top_rated']
    }],
    verifiedAt: Date
  },
  // Portfolio/Gallery Section - Simplified to prevent CastError
  portfolio: {
    type: mongoose.Schema.Types.Mixed
  },
  // Emergency Contacts - Simplified to prevent CastError
  emergencyContacts: {
    type: mongoose.Schema.Types.Mixed
  },
  // Enhanced Documents System
  documents: [{
    name: {
      type: String,
      trim: true,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['id', 'certification', 'reference', 'medical', 'insurance', 'other'],
      required: true
    },
    category: {
      type: String,
      trim: true
    },
    size: {
      type: Number,
      min: 0
    },
    verified: {
      type: Boolean,
      default: false
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    uploadedAt: { 
      type: Date, 
      default: Date.now 
    },
    expiryDate: Date
  }],
  // Job completion tracking
  hasCompletedJobs: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Only calculate trust score when explicitly needed
      if (ret.includeCalculations !== false) {
        ret.trustScore = doc.calculateTrustScore();
      }
      delete ret.includeCalculations;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Optimized virtual for profile completion percentage
CaregiverSchema.virtual('profileCompletionPercentage').get(function() {
  // Cache calculation to avoid repeated computation
  if (this._profileCompletionCache) {
    return this._profileCompletionCache;
  }
  
  let completed = 0;
  const total = 10;
  
  if (this.name) completed++;
  if (this.bio) completed++;
  if (this.profileImage) completed++;
  if (this.skills?.length > 0) completed++;
  if (this.experience?.description) completed++;
  if (this.hourlyRate) completed++;
  if (this.certifications?.length > 0) completed++;
  if (this.availability?.days?.length > 0) completed++;
  if (this.emergencyContacts?.length > 0) completed++;
  if (this.ageCareRanges?.length > 0) completed++;
  
  const result = Math.round((completed / total) * 100);
  this._profileCompletionCache = result;
  return result;
});

// Optimized method to calculate trust score
CaregiverSchema.methods.calculateTrustScore = function() {
  // Cache calculation to avoid repeated computation
  if (this._trustScoreCache) {
    return this._trustScoreCache;
  }
  
  let score = 0;
  
  // Profile completeness (30 points)
  score += (this.profileCompletionPercentage / 100) * 30;
  
  // Background check (25 points)
  if (this.backgroundCheck?.status === 'approved') score += 25;
  
  // Certifications (20 points) - optimized filter
  const verifiedCerts = this.certifications?.filter(cert => cert.verified)?.length || 0;
  score += Math.min(verifiedCerts * 5, 20);
  
  // Reviews and rating (15 points)
  const rating = this.rating || 0;
  if (rating >= 4.5) score += 15;
  else if (rating >= 4.0) score += 10;
  else if (rating >= 3.5) score += 5;
  
  // Identity verification (10 points)
  if (this.verification?.identityVerified) score += 10;
  
  const result = Math.min(Math.round(score), 100);
  this._trustScoreCache = result;
  return result;
};

// Pre-save middleware to generate caregiverId
CaregiverSchema.pre('save', async function(next) {
  if (!this.caregiverId) {
    // Generate unique caregiver ID (CG + timestamp + random)
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    this.caregiverId = `CG${timestamp}${random}`.toUpperCase();
  }
  next();
});

// Indexes for better query performance
CaregiverSchema.index({ caregiverId: 1 }, { unique: true });
CaregiverSchema.index({ userId: 1 }, { unique: true });
CaregiverSchema.index({ 'backgroundCheck.status': 1 });
CaregiverSchema.index({ skills: 1 });
CaregiverSchema.index({ rating: -1 });
CaregiverSchema.index({ ageCareRanges: 1 });
CaregiverSchema.index({ 'verification.trustScore': -1 });
CaregiverSchema.index({ 'verification.badges': 1 });
CaregiverSchema.index({ hourlyRate: 1 });
CaregiverSchema.index({ 'availability.days': 1 });

module.exports = mongoose.model('Caregiver', CaregiverSchema);