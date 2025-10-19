const ErrorResponse = require('../utils/errorResponse');
const logger = require('../utils/logger');
const { isCelebrateError } = require('celebrate');
const { NODE_ENV } = require('../config');

// Define error type mappings for better organization
const ERROR_MAPPINGS = {
  CastError: (err) => 
    ErrorResponse.notFound(`Resource not found with id of ${err.value}`),
  
  '11000': (err) => 
    ErrorResponse.conflict(`Duplicate field value: ${JSON.stringify(err.keyValue)}`),
  
  ValidationError: (err) => 
    ErrorResponse.badRequest(
      'Validation Error',
      Object.values(err.errors).map(e => ({
        field: e.path,
        message: e.message
      }))
    ),
  
  JsonWebTokenError: () => 
    ErrorResponse.unauthorized('Invalid token'),
  
  TokenExpiredError: () => 
    ErrorResponse.unauthorized('Token expired', [], 'token_expired'),
  
  AxiosError: (err) => 
    ErrorResponse.gatewayError(
      err.response?.data?.message || 'External service request failed',
      err.response?.data?.details
    )
};

module.exports = (err, req, res, next) => {
  // Default error response
  let error = new ErrorResponse(
    err.message || 'Internal Server Error',
    err.statusCode || 500,
    err.details,
    err.errorType,
    err.errorCode
  );

  // Log errors based on environment
  logError(err, req, error);

  // Handle specific error types
  if (isCelebrateError(err)) {
    error = handleCelebrateError(err);
  } else if (err.isOperational) {
    // Already an ErrorResponse - no change needed
  } else if (ERROR_MAPPINGS[err.name]) {
    error = ERROR_MAPPINGS[err.name](err);
  } else if (err.code && ERROR_MAPPINGS[err.code]) {
    error = ERROR_MAPPINGS[err.code](err);
  } else if (err.isAxiosError && ERROR_MAPPINGS.AxiosError) {
    error = ERROR_MAPPINGS.AxiosError(err);
  } else if (NODE_ENV === 'production') {
    // Mask non-operational errors in production
    error = new ErrorResponse('Internal Server Error', 500);
  }

  // Send formatted response
  sendErrorResponse(error, req, res);
};

// Helper functions for better separation of concerns
function logError(err, req, error) {
  if (NODE_ENV === 'development') {
    logger.error(`💥 ${err.stack || err.message}`);
    console.error('\x1b[31m%s\x1b[0m', `[${new Date().toISOString()}] ERROR:`, {
      message: err.message,
      path: req.path,
      method: req.method,
      ip: req.ip,
      stack: err.stack
    });
  } else {
    logger.error(`${error.statusCode} - ${error.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
  }
}

function handleCelebrateError(err) {
  const details = [];
  for (const [segment, joiError] of err.details.entries()) {
    details.push(...joiError.details.map(d => ({
      field: d.context.key,
      location: segment,
      message: d.message.replace(/['"]+/g, ''),
      type: d.type
    })));
  }
  return ErrorResponse.unprocessableEntity('Validation failed', details);
}

function sendErrorResponse(error, req, res) {
  const response = {
    success: false,
    status: error.status,
    message: error.message,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    ...(error.details?.length > 0 && { details: error.details }),
    ...(NODE_ENV === 'development' && {
      stack: error.stack,
      type: error.errorType,
      originalError: {
        name: err.name,
        message: err.message
      }
    })
  };

  res.status(error.statusCode).json(response);
}