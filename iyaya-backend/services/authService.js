// services/authService.js
const jwt = require('jsonwebtoken');
const { jwtSecret, jwtExpiry } = require('../config/auth');

exports.generateToken = (user) => {
  if (!user || !user._id) {
    throw new Error('Invalid user object for token generation');
  }

  if (!jwtSecret || !jwtExpiry) {
    throw new Error('Missing JWT configuration');
  }

  const payload = {
    id: user._id,
    role: user.role || 'user', // Default role if not specified
    email: user.email
  };

  return jwt.sign(
    payload,
    jwtSecret,
    { 
      expiresIn: jwtExpiry,
      algorithm: 'HS256'
    }
  );
};

// Add token verification function
exports.verifyToken = (token) => {
  return jwt.verify(token, jwtSecret);
};