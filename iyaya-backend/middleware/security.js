const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again after 15 minutes'
});

// Security headers
const securityHeaders = [
  helmet(),
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  }),
  helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }),
  helmet.frameguard({ action: 'deny' }),
  helmet.xssFilter(),
  helmet.noSniff(),
  helmet.hidePoweredBy(),
  helmet.referrerPolicy({ policy: 'same-origin' })
];

// Data sanitization
const dataSanitization = [
  mongoSanitize(),
  xss(),
  hpp({
    whitelist: ['duration', 'ratingsQuantity', 'ratingsAverage', 'maxGroupSize', 'difficulty', 'price']
  })
];

module.exports = { limiter, securityHeaders, dataSanitization };