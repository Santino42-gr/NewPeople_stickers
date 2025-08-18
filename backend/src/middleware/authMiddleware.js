/**
 * Authentication Middleware
 * Handles Telegram webhook verification and authorization
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const validators = require('../utils/validators');
const { REQUIRED_ENV_VARS } = require('../config/constants');

class AuthMiddleware {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;
    this.webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
    
    // Validate required environment variables
    this.validateEnvironment();
  }

  /**
   * Validate required environment variables
   */
  validateEnvironment() {
    const missingVars = REQUIRED_ENV_VARS.filter(varName => {
      const value = process.env[varName];
      return !value || value === `your_${varName.toLowerCase()}`;
    });

    if (missingVars.length > 0) {
      logger.logSecurity('missing_environment_variables', 'error', {
        missingVars,
        required: REQUIRED_ENV_VARS
      });
    }
  }

  /**
   * Verify Telegram webhook signature
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  verifyTelegramWebhook(req, res, next) {
    try {
      // Skip verification in development if not configured
      if (process.env.NODE_ENV === 'development' && !this.botToken) {
        logger.warn('Webhook verification skipped in development - bot token not configured');
        return next();
      }

      if (!this.botToken) {
        logger.logSecurity('webhook_verification_failed', 'error', {
          reason: 'bot_token_missing',
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        return res.status(401).json({ error: 'Unauthorized - Bot token not configured' });
      }

      // Validate request structure
      const payload = req.body;
      const webhookValidation = validators.isValidWebhookPayload(payload);
      
      if (!webhookValidation.valid) {
        logger.logSecurity('webhook_validation_failed', 'warn', {
          error: webhookValidation.error,
          ip: req.ip,
          hasBody: !!req.body,
          bodyKeys: req.body ? Object.keys(req.body) : []
        });
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }

      // Verify webhook signature if secret is set
      if (this.webhookSecret) {
        const signature = req.get('X-Telegram-Bot-Api-Secret-Token');
        
        if (signature !== this.webhookSecret) {
          logger.logSecurity('webhook_signature_mismatch', 'error', {
            hasSignature: !!signature,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
          return res.status(401).json({ error: 'Unauthorized - Invalid signature' });
        }
      }

      // Additional security headers validation
      const userAgent = req.get('User-Agent');
      if (userAgent && !userAgent.includes('TelegramBot')) {
        logger.logSecurity('suspicious_user_agent', 'warn', {
          userAgent,
          ip: req.ip,
          updateId: payload.update_id
        });
      }

      // Validate content type
      const contentType = req.get('Content-Type');
      if (contentType && !contentType.includes('application/json')) {
        logger.logSecurity('invalid_content_type', 'warn', {
          contentType,
          ip: req.ip
        });
        return res.status(400).json({ error: 'Invalid content type' });
      }

      // Log successful verification
      logger.logSecurity('webhook_verified', 'info', {
        updateId: payload.update_id,
        updateType: this.getUpdateType(payload),
        ip: req.ip
      });

      next();

    } catch (error) {
      logger.logSecurity('webhook_verification_error', 'error', {
        error: error.message,
        stack: error.stack,
        ip: req.ip
      });
      
      res.status(500).json({ error: 'Internal security error' });
    }
  }

  /**
   * Verify API key for internal endpoints
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  verifyApiKey(req, res, next) {
    const apiKey = req.get('X-API-Key') || req.get('Authorization')?.replace('Bearer ', '');
    const validApiKey = process.env.API_KEY;

    if (!validApiKey) {
      // If no API key is set, allow access in development
      if (process.env.NODE_ENV === 'development') {
        logger.warn('API key verification skipped - not configured');
        return next();
      }
      
      return res.status(500).json({ error: 'API key not configured' });
    }

    if (!apiKey || apiKey !== validApiKey) {
      logger.logSecurity('invalid_api_key', 'warn', {
        hasApiKey: !!apiKey,
        ip: req.ip,
        endpoint: req.path,
        method: req.method
      });
      
      return res.status(401).json({ error: 'Invalid API key' });
    }

    logger.logSecurity('api_key_verified', 'info', {
      ip: req.ip,
      endpoint: req.path,
      method: req.method
    });

    next();
  }

  /**
   * Block suspicious requests based on patterns
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  blockSuspiciousRequests(req, res, next) {
    const suspiciousPatterns = [
      // Common attack patterns
      /\.\.(\/|\\)/,  // Directory traversal
      /<script/i,     // XSS attempts
      /union.*select/i, // SQL injection
      /eval\(/i,      // Code injection
      /javascript:/i, // JavaScript injection
    ];

    const requestData = JSON.stringify({
      url: req.url,
      query: req.query,
      body: req.body,
      headers: req.headers
    });

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(requestData)) {
        logger.logSecurity('suspicious_request_blocked', 'error', {
          pattern: pattern.toString(),
          ip: req.ip,
          url: req.url,
          userAgent: req.get('User-Agent'),
          body: typeof req.body === 'object' ? Object.keys(req.body) : req.body
        });
        
        return res.status(400).json({ error: 'Request blocked' });
      }
    }

    next();
  }

  /**
   * Validate request size limits
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  validateRequestSize(req, res, next) {
    const maxBodySize = 10 * 1024 * 1024; // 10MB
    const bodySize = parseInt(req.get('Content-Length') || '0', 10);

    if (bodySize > maxBodySize) {
      logger.logSecurity('request_too_large', 'warn', {
        bodySize,
        maxBodySize,
        ip: req.ip,
        endpoint: req.path
      });
      
      return res.status(413).json({ error: 'Request too large' });
    }

    next();
  }

  /**
   * Get update type from Telegram webhook payload
   * @param {Object} payload - Webhook payload
   * @returns {string} - Update type
   */
  getUpdateType(payload) {
    const types = ['message', 'edited_message', 'callback_query', 'inline_query'];
    for (const type of types) {
      if (payload[type]) {
        return type;
      }
    }
    return 'unknown';
  }

  /**
   * Create middleware that combines multiple security checks
   * @returns {Function} - Combined middleware
   */
  createSecurityMiddleware() {
    return [
      this.validateRequestSize.bind(this),
      this.blockSuspiciousRequests.bind(this),
      this.verifyTelegramWebhook.bind(this)
    ];
  }

  /**
   * Create middleware for internal API endpoints
   * @returns {Function} - API middleware
   */
  createApiSecurityMiddleware() {
    return [
      this.validateRequestSize.bind(this),
      this.blockSuspiciousRequests.bind(this),
      this.verifyApiKey.bind(this)
    ];
  }
}

// Export singleton instance
module.exports = new AuthMiddleware();