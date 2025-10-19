# Backend Utilities Documentation

This directory contains consolidated utilities for the Iyaya backend, replacing duplicate functionality across controllers and middleware.

## 📁 File Structure

```
utils/
├── auth.js          # Authentication & Authorization
├── validation.js    # Input Validation & Sanitization  
├── config.js        # Configuration & Constants
└── README.md        # This documentation
```

## 🔐 Authentication & Authorization (`auth.js`)

Consolidated authentication and authorization system combining functionality from:
- `middleware/auth.js` 
- `middleware/authorization.js`

### Key Features
- JWT token verification with role mapping
- Development bypass functionality
- Role-based authorization with synonym support
- Token generation utilities
- Enhanced error handling

### Usage Examples

```javascript
const { authenticate, authorize, requireParent } = require('../utils/auth');

// Basic authentication
router.use(authenticate);

// Role-based authorization
router.get('/admin', authenticate, authorize(['admin']), controller.adminOnly);

// Convenience methods
router.get('/parent-only', authenticate, requireParent(), controller.parentData);
router.get('/caregiver-only', authenticate, requireCaregiver(), controller.caregiverData);

// Self or admin access
router.get('/profile/:userId', authenticate, requireSelfOrAdmin('userId'), controller.getProfile);
```

### Available Middleware
- `authenticate` - JWT token verification
- `authorize(roles)` - Role-based access control
- `checkUserType(types)` - Legacy user type checking
- `requireAdmin()` - Admin-only access
- `requireParent()` - Parent-only access  
- `requireCaregiver()` - Caregiver-only access
- `requireSelfOrAdmin(param)` - Self or admin access

## ✅ Validation (`validation.js`)

Unified validation system supporting both Joi and express-validator patterns, consolidating:
- `controllers/validation.js`
- `controllers/custom.validation.js`
- `middleware/validation.js`
- `middleware/validate.js`

### Key Features
- Dual validation system (Joi + express-validator)
- Custom validators for common patterns
- Comprehensive schema definitions
- Input sanitization utilities
- Backward compatibility

### Usage Examples

```javascript
const { validate, validateJoi, sanitizeInput } = require('../utils/validation');

// Using Joi validation (default)
router.post('/register', validate('register'), controller.register);

// Using express-validator
router.post('/login', validate('login', 'express-validator'), controller.login);

// Custom validation schemas
router.post('/booking', validate('createBooking'), controller.createBooking);

// Input sanitization
const cleanEmail = sanitizeInput.email(req.body.email);
```

### Available Schemas
- **Auth**: `register`, `login`, `refreshTokens`, `forgotPassword`, `resetPassword`, `verifyEmail`
- **Profile**: `updateProfile`
- **Booking**: `createBooking`, `updateBooking`
- **Job**: `createJob`

### Custom Validators
- `password` - Strong password validation
- `objectId` - MongoDB ObjectId validation
- `phoneNumber` - Phone number format validation
- `dateOfBirth` - Age validation

## ⚙️ Configuration (`config.js`)

Centralized configuration system consolidating:
- `config/auth.js`
- `config/constants.js`
- Environment variable management

### Key Features
- Environment variable management
- Application constants
- Database configuration
- Rate limiting settings
- CORS configuration
- Validation helpers

### Usage Examples

```javascript
const { env, constants, auth, validation } = require('../utils/config');

// Environment variables
const port = env.PORT;
const jwtSecret = env.JWT_SECRET;

// Application constants
const userRoles = constants.USER_ROLES;
const bookingStatus = constants.BOOKING_STATUS;

// Configuration objects
const corsOptions = require('../utils/config').cors;
const rateLimitConfig = require('../utils/config').rateLimiting.api;

// Validation helpers
if (validation.isValidEmail(email)) {
  // Process email
}
```

### Available Configurations
- `env` - Environment variables
- `constants` - Application constants
- `auth` - Authentication settings
- `database` - Database configuration
- `rateLimiting` - Rate limit settings
- `cors` - CORS configuration
- `logging` - Logging configuration

## 🔄 Migration Guide

### From Old Validation System

**Before:**
```javascript
const { validate } = require('../controllers/validation');
const { password } = require('../controllers/custom.validation');
```

**After:**
```javascript
const { validate, customValidators } = require('../utils/validation');
```

### From Old Auth System

**Before:**
```javascript
const { authenticate } = require('../middleware/auth');
const { checkUserType } = require('../middleware/authorization');
```

**After:**
```javascript
const { authenticate, checkUserType } = require('../utils/auth');
```

### From Old Config System

**Before:**
```javascript
const { jwtSecret } = require('../config/auth');
const { regEx } = require('../config/constants');
```

**After:**
```javascript
const { auth, regEx } = require('../utils/config');
const jwtSecret = auth.jwtSecret;
```

## 🧪 Testing

To test the consolidated utilities:

```bash
# Run backend tests
npm test

# Test specific utility
npm test -- --grep "auth utils"
npm test -- --grep "validation utils"
```

## 🚀 Benefits

### Code Reduction
- **Validation**: Reduced from 4 files to 1 comprehensive utility
- **Auth**: Consolidated 3 middleware files into 1 utility
- **Config**: Centralized scattered configuration

### Improved Maintainability
- Single source of truth for validation rules
- Consistent error handling and responses
- Unified authentication/authorization logic
- Centralized configuration management

### Enhanced Features
- Better error messages with error codes
- Development bypass functionality
- Role synonym support
- Input sanitization utilities
- Comprehensive logging

### Backward Compatibility
- Legacy function exports maintained
- Existing route patterns supported
- Gradual migration possible

## 📝 Notes

- All route files have been updated to use consolidated utilities
- Original duplicate files can be safely removed
- Development bypass requires `ALLOW_DEV_BYPASS=true` environment variable
- JWT secrets must be configured in environment variables
- Rate limiting configurations are now centralized in `config.js`

## 🔧 Environment Variables Required

```env
# Authentication
JWT_SECRET=your-jwt-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Development
NODE_ENV=development
ALLOW_DEV_BYPASS=true

# Database
MONGODB_URI=mongodb://localhost:27017/iyaya

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX_REQUESTS=100
```
