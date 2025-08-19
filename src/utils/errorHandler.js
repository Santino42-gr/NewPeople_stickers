/**
 * Centralized error handling utility
 * Provides consistent error handling across the application
 */

const logger = require('./logger');

class ErrorHandler {
  /**
   * Express error handling middleware
   * Should be used as the last middleware in the chain
   */
  handle(error, req, res, next) {
    logger.error('Unhandled error:', {
      message: error.message,
      stack: error.stack,
      url: req?.url,
      method: req?.method,
      ip: req?.ip,
      userAgent: req?.get('User-Agent')
    });

    // Default error response
    let statusCode = 500;
    let message = 'Internal server error';
    let details = {};

    // Handle specific error types
    if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Invalid request data';
      details = { validation: error.message };
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      message = 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      message = 'Forbidden';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      message = 'Not found';
    } else if (error.name === 'TooManyRequestsError') {
      statusCode = 429;
      message = 'Too many requests';
    }

    // Include error details in development
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      details = {
        ...details,
        error: error.message,
        stack: error.stack
      };
    }

    // Send error response
    res.status(statusCode).json({
      success: false,
      error: message,
      ...(Object.keys(details).length > 0 && { details })
    });
  }

  /**
   * Safe execution wrapper for async functions
   * Automatically catches and handles errors
   */
  async safeExecute(asyncFunction, fallbackValue = null) {
    try {
      return await asyncFunction();
    } catch (error) {
      logger.error('Safe execute error:', error);
      return fallbackValue;
    }
  }

  /**
   * Wrap async route handlers to catch errors
   */
  asyncHandler(fn) {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }

  /**
   * Create custom error with specific type
   */
  createError(message, type = 'Error', statusCode = 500) {
    const error = new Error(message);
    error.name = type;
    error.statusCode = statusCode;
    return error;
  }

  /**
   * Handle Telegram API errors
   */
  handleTelegramError(error, context = {}) {
    const telegramErrorCodes = {
      400: 'Bad Request - Invalid request parameters',
      401: 'Unauthorized - Invalid bot token',
      403: 'Forbidden - Bot was blocked or insufficient permissions',
      404: 'Not Found - Chat or user not found',
      409: 'Conflict - Bot is already running with webhook',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Telegram server error'
    };

    const statusCode = error.response?.status || 500;
    const telegramMessage = telegramErrorCodes[statusCode] || 'Unknown Telegram API error';
    
    logger.error('Telegram API error:', {
      statusCode,
      message: error.message,
      telegramMessage,
      context
    });

    return this.createError(telegramMessage, 'TelegramApiError', statusCode);
  }

  /**
   * Handle Piapi API errors
   */
  handlePiapiError(error, context = {}) {
    const piapiErrorCodes = {
      400: 'Bad Request - Invalid parameters',
      401: 'Unauthorized - Invalid API key',
      402: 'Payment Required - Insufficient credits',
      403: 'Forbidden - Access denied',
      404: 'Not Found - Endpoint not found',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error - Piapi server error',
      503: 'Service Unavailable - Piapi service temporarily unavailable'
    };

    const statusCode = error.response?.status || 500;
    const piapiMessage = piapiErrorCodes[statusCode] || 'Unknown Piapi API error';
    
    logger.error('Piapi API error:', {
      statusCode,
      message: error.message,
      piapiMessage,
      context
    });

    return this.createError(piapiMessage, 'PiapiApiError', statusCode);
  }

  /**
   * Handle database errors
   */
  handleDatabaseError(error, context = {}) {
    logger.error('Database error:', {
      message: error.message,
      code: error.code,
      context
    });

    // Don't expose database details to client
    return this.createError('Database operation failed', 'DatabaseError', 500);
  }

  /**
   * Handle image processing errors
   */
  handleImageProcessingError(error, context = {}) {
    const imageErrorCodes = {
      'INVALID_FORMAT': 'Unsupported image format',
      'FILE_TOO_LARGE': 'Image file is too large',
      'INVALID_DIMENSIONS': 'Image dimensions are invalid',
      'PROCESSING_FAILED': 'Image processing failed',
      'CONVERSION_FAILED': 'Image conversion failed',
      'OPTIMIZATION_FAILED': 'Image optimization failed'
    };

    const errorCode = error.code || 'PROCESSING_FAILED';
    const imageMessage = imageErrorCodes[errorCode] || 'Image processing error';
    
    logger.error('Image processing error:', {
      code: errorCode,
      message: error.message,
      imageMessage,
      context
    });

    return this.createError(imageMessage, 'ImageProcessingError', 400);
  }

  /**
   * Handle network/timeout errors
   */
  handleNetworkError(error, context = {}) {
    let errorMessage = 'Network error occurred';
    let statusCode = 500;

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Service unavailable - connection refused';
      statusCode = 503;
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      errorMessage = 'Service timeout - please try again later';
      statusCode = 504;
    } else if (error.code === 'ECONNRESET') {
      errorMessage = 'Connection reset - service may be overloaded';
      statusCode = 503;
    }

    logger.error('Network error:', {
      code: error.code,
      message: error.message,
      errorMessage,
      context
    });

    return this.createError(errorMessage, 'NetworkError', statusCode);
  }

  /**
   * Enhanced safe execution with retries
   */
  async safeExecuteWithRetries(asyncFunction, fallbackFunction = null, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await asyncFunction();
      } catch (error) {
        lastError = error;
        
        logger.warn(`Safe execute attempt ${attempt}/${maxRetries} failed:`, {
          error: error.message,
          attempt
        });

        if (attempt === maxRetries) {
          break;
        }

        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }

    logger.error('All safe execute attempts failed:', lastError);

    // Try fallback function if provided
    if (fallbackFunction && typeof fallbackFunction === 'function') {
      try {
        logger.info('Attempting fallback function...');
        return await fallbackFunction();
      } catch (fallbackError) {
        logger.error('Fallback function also failed:', fallbackError);
      }
    }

    throw lastError;
  }

  /**
   * Graceful degradation handler
   */
  async gracefulDegrade(primaryFunction, degradedFunction, context = {}) {
    try {
      return await primaryFunction();
    } catch (error) {
      logger.warn('Primary function failed, using degraded mode:', {
        error: error.message,
        context
      });
      
      return await degradedFunction();
    }
  }
}

// Export singleton instance
module.exports = new ErrorHandler();