const { NODE_ENV } = require('../config');
const logger = require('../utils/logger');

class ErrorResponse extends Error {
  /**
   * Enhanced error handling with simplified interface
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Machine-readable error code
   * @param {Object} [validationErrors={}] - Validation error details
   * @param {Object} [metadata={}] - Additional error metadata
   */
  constructor(message, statusCode, code, validationErrors = {}, metadata = {}) {
    super(message);
    
    // Core error properties
    this.statusCode = statusCode || 500;
    // Alias for middleware that expects `err.status`
    this.status = this.statusCode;
    this.code = code || this.generateErrorCode();
    this.validationErrors = validationErrors;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
    this.isOperational = true;

    // Stack trace handling
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Immediate error logging
    this.logError();
  }

  /**
   * Generate standardized error code
   */
  generateErrorCode() {
    const prefix = this.statusCode < 500 ? 'CLIENT' : 'SERVER';
    return `${prefix}-${this.statusCode}-${Math.floor(Math.random() * 1000)}`;
  }

  /**
   * Log the error appropriately
   */
  logError() {
    const logEntry = {
      timestamp: this.timestamp,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      validationErrors: this.validationErrors,
      metadata: this.metadata,
      ...(NODE_ENV === 'development' && { stack: this.stack })
    };

    logger.error(logEntry);
  }

  /**
   * Convert error to API response format
   */
  toJSON() {
    const baseResponse = {
      success: false,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      ...(Object.keys(this.validationErrors).length > 0 && { 
        errors: this.validationErrors 
      })
    };

    // Only include debug info in development
    if (NODE_ENV === 'development') {
      return {
        ...baseResponse,
        stack: this.stack,
        metadata: this.metadata
      };
    }

    return baseResponse;
  }

  /* ========== Static Factory Methods ========== */
  
  static badRequest(message = 'Bad Request', validationErrors = {}) {
    return new ErrorResponse(message, 400, 'BAD_REQUEST', validationErrors);
  }

  static unauthorized(message = 'Not Authorized') {
    return new ErrorResponse(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Forbidden') {
    return new ErrorResponse(message, 403, 'FORBIDDEN');
  }

  static notFound(message = 'Resource Not Found') {
    return new ErrorResponse(message, 404, 'NOT_FOUND');
  }

  static conflict(message = 'Conflict Occurred') {
    return new ErrorResponse(message, 409, 'CONFLICT');
  }

  static validationError(message = 'Validation Failed', validationErrors = {}) {
    return new ErrorResponse(message, 422, 'VALIDATION_FAILED', validationErrors);
  }

  static internalError(message = 'Internal Server Error') {
    return new ErrorResponse(message, 500, 'INTERNAL_ERROR');
  }

  static fromError(error, metadata = {}) {
    if (error instanceof ErrorResponse) {
      return error;
    }

    return new ErrorResponse(
      error.message,
      error.statusCode || 500,
      error.code || 'UNKNOWN_ERROR',
      error.validationErrors || {},
      metadata
    );
  }
}

module.exports = ErrorResponse;