const mongoose = require('mongoose');
const { isEmail } = require('validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  // Firebase UID for Firebase-authenticated users
  firebaseUid: {
    type: String,
    unique: true,
    sparse: true, // Allows null values for non-Firebase users
    index: true
  },
  email: {
    type: String,
    required: [true, 'Please enter an email'],
    unique: [true, 'Email already exists'],
    validate: [isEmail, 'Please enter a valid email'],
    lowercase: true,
    trim: true,
    index: true
  },
  password: {
    type: String,
    required: [
      function() { return !this.firebaseUid; }, 
      'Password is required for non-Firebase users'
    ],
    minlength: [
      process.env.NODE_ENV === 'production' ? 12 : 8, 
      `Minimum password length is ${process.env.NODE_ENV === 'production' ? 12 : 8} characters`
    ],
    select: false
  },
  role: {
    type: String,
    enum: ['parent', 'caregiver'],
    default: 'parent',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Please enter your name'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  // Children array for parent users
  children: [
    {
      name: { type: String, required: true },
      birthdate: { type: Date },
      notes: { type: String }
    }
  ],
  firstName: {
    type: String,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  middleInitial: {
    type: String,
    trim: true,
    maxlength: [1, 'Middle initial must be 1 character']
  },
  birthDate: {
    type: Date
  },
  phone: {
    type: String,
    validate: {
      validator: v => /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/im.test(v),
      message: props => `${props.value} is not a valid phone number!`
    }
  },
  // Optional profile image URL
  profileImage: {
    type: String,
    default: undefined
  },
  // Authentication provider information
  authProvider: {
    type: String,
    enum: ['local', 'firebase', 'facebook', 'google'],
    default: 'local'
  },
  // Social media provider IDs
  facebookId: {
    type: String,
    sparse: true,
    index: true
  },
  googleId: {
    type: String,
    sparse: true,
    index: true
  },
  // Optional address for client users
  address: {
    street: { type: String },
    city: { type: String },
    province: { type: String },
    postalCode: { type: String },
    country: { type: String }
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'banned'],
    default: 'active'
  },
  verification: {
    emailVerified: { type: Boolean, default: false },
    token: String,
    expires: Date,
    backgroundCheckVerified: { type: Boolean, default: false }
  },
  tokenVersion: {
    type: Number,
    default: 0
  },
  passwordChangedAt: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
  lastLogin: { type: Date },
  loginHistory: [{
    date: Date,
    ip: String,
    device: String,
    location: String
  }],
  trustedDevices: [String],
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String, select: false }
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform(doc, ret) {
      delete ret.password;
      delete ret.__v;
      delete ret.verification?.token;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.loginHistory;
      delete ret.trustedDevices;
      delete ret.twoFactorSecret;
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Password hashing middleware
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.passwordChangedAt = Date.now() - 1000;
    next();
  } catch (err) {
    next(err);
  }
});

// Enhanced password comparison method
UserSchema.methods.comparePassword = async function(candidatePassword) {
  // Added comprehensive validation
  if (!candidatePassword || typeof candidatePassword !== 'string') {
    console.error('Invalid candidate password:', {
      type: typeof candidatePassword,
      length: candidatePassword?.length
    });
    return false;
  }

  if (!this.password) {
    console.error('No password set for user:', this._id);
    return false;
  }

  try {
    const isMatch = await bcrypt.compare(candidatePassword, this.password);
    if (!isMatch) {
      console.log('Password comparison failed for user:', this._id);
    }
    return isMatch;
  } catch (err) {
    console.error('Password comparison error:', {
      userId: this._id,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
    return false;
  }
};

// Sync version for specific use cases
UserSchema.methods.comparePasswordSync = function(candidatePassword) {
  if (!candidatePassword || !this.password) return false;
  return bcrypt.compareSync(candidatePassword, this.password);
};

// Auth JSON representation
UserSchema.methods.toAuthJSON = function() {
  return {
    id: this._id,
    email: this.email,
    role: this.role,
    name: this.name,
    phone: this.phone,
    status: this.status,
    isVerified: this.verification.emailVerified,
    createdAt: this.createdAt,
    twoFactorEnabled: this.twoFactorEnabled
  };
};

// Login attempt tracking
UserSchema.methods.incrementLoginAttempts = async function() {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    this.lockUntil = Date.now() + 30 * 60 * 1000; // 30 minutes
  }
  return this.save();
};

UserSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockUntil = undefined;
  return this.save();
};

UserSchema.methods.isLocked = function() {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Password reset token generation
UserSchema.methods.createPasswordResetToken = async function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  await this.save();
  return resetToken;
};

// Email verification token
UserSchema.methods.createVerificationToken = async function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.verification.token = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.verification.expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  await this.save();
  return verificationToken;
};

// Check if password was changed after token was issued
UserSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10
    );
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

// Invalidate all tokens (for logout all devices)
UserSchema.methods.invalidateTokens = async function() {
  this.tokenVersion += 1;
  return this.save();
};

// Static method to find user by email
UserSchema.statics.findByEmail = async function(email, select = '+password') {
  return this.findOne({ email }).select(select);
};

// Virtual for provider profile link
UserSchema.virtual('providerProfile', {
  ref: 'Provider',
  localField: '_id',
  foreignField: 'userId',
  justOne: true
});

// Indexes
UserSchema.index({ status: 1 });
UserSchema.index({ 'verification.emailVerified': 1 });

// Virtual for location (backward compatibility)
UserSchema.virtual('location').get(function() {
  if (this.address) {
    if (typeof this.address === 'string') return this.address;
    if (this.address.street) return this.address.street;
    if (this.address.city) return this.address.city;
  }
  return null;
});

module.exports = mongoose.model('User', UserSchema);