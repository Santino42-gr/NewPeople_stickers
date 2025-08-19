/**
 * Validation Middleware
 * Provides comprehensive input validation for all endpoints
 */

const logger = require('../utils/logger');
const validators = require('../utils/validators');
const errorHandler = require('../utils/errorHandler');
const { VALIDATION, CONFIG } = require('../config/constants');

class ValidationMiddleware {
  /**
   * Validate Telegram webhook payload
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  validateWebhookPayload(req, res, next) {
    try {
      const payload = req.body;

      // Basic payload structure validation
      const webhookValidation = validators.isValidWebhookPayload(payload);
      if (!webhookValidation.valid) {
        logger.logSecurity('webhook_payload_invalid', 'warn', {
          error: webhookValidation.error,
          updateId: payload?.update_id,
          hasMessage: !!payload?.message,
          ip: req.ip
        });

        return res.status(400).json({
          error: 'Invalid webhook payload',
          details: webhookValidation.error
        });
      }

      // Validate message if present
      if (payload.message) {
        const messageValidation = validators.isValidTelegramMessage(payload.message);
        if (!messageValidation.valid) {
          logger.logSecurity('telegram_message_invalid', 'warn', {
            error: messageValidation.error,
            messageId: payload.message?.message_id,
            userId: payload.message?.from?.id,
            ip: req.ip
          });

          return res.status(400).json({
            error: 'Invalid message format',
            details: messageValidation.error
          });
        }

        // Additional message validation
        this.validateMessageContent(payload.message, req, res);
      }

      // Store validated data for later use
      req.validatedPayload = payload;
      next();

    } catch (error) {
      logger.error('Webhook validation error:', error);
      res.status(500).json({ error: 'Validation error' });
    }
  }

  /**
   * Validate message content and attachments
   * @param {Object} message - Telegram message object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  validateMessageContent(message, req, res) {
    // Validate user ID
    if (message.from?.id) {
      const userIdValidation = validators.isValidUserId(message.from.id);
      if (!userIdValidation.valid) {
        logger.logSecurity('invalid_user_id', 'warn', {
          userId: message.from.id,
          error: userIdValidation.error,
          ip: req.ip
        });
      }
    }

    // Validate chat ID
    if (message.chat?.id) {
      const chatIdValidation = validators.isValidChatId(message.chat.id);
      if (!chatIdValidation.valid) {
        logger.logSecurity('invalid_chat_id', 'warn', {
          chatId: message.chat.id,
          error: chatIdValidation.error,
          ip: req.ip
        });
      }
    }

    // Validate text content
    if (message.text) {
      const sanitizedText = validators.sanitizeText(message.text);
      if (sanitizedText !== message.text) {
        logger.logSecurity('message_text_sanitized', 'info', {
          originalLength: message.text.length,
          sanitizedLength: sanitizedText.length,
          userId: message.from?.id,
          ip: req.ip
        });
        
        // Update message with sanitized text
        message.text = sanitizedText;
      }

      // Check message length
      if (message.text.length > VALIDATION.MAX_MESSAGE_LENGTH) {
        logger.logSecurity('message_too_long', 'warn', {
          messageLength: message.text.length,
          maxLength: VALIDATION.MAX_MESSAGE_LENGTH,
          userId: message.from?.id,
          ip: req.ip
        });
      }
    }

    // Validate photo array if present
    if (message.photo) {
      const photoValidation = validators.isValidPhotoArray(message.photo);
      if (!photoValidation.valid) {
        logger.logSecurity('invalid_photo_array', 'warn', {
          error: photoValidation.error,
          photoCount: message.photo?.length || 0,
          userId: message.from?.id,
          ip: req.ip
        });
      }
    }
  }

  /**
   * Validate file uploads and media
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  validateMediaUpload(req, res, next) {
    const message = req.validatedPayload?.message;
    
    if (!message) {
      return next();
    }

    try {
      // Validate photo uploads
      if (message.photo && Array.isArray(message.photo)) {
        const validationResult = this.validatePhotoUpload(message.photo);
        if (!validationResult.valid) {
          logger.logSecurity('photo_upload_rejected', 'warn', {
            error: validationResult.error,
            userId: message.from?.id,
            photoCount: message.photo.length,
            ip: req.ip
          });

          return res.status(400).json({
            error: 'Invalid photo upload',
            details: validationResult.error
          });
        }
      }

      // Validate document uploads
      if (message.document) {
        const documentValidation = this.validateDocument(message.document);
        if (!documentValidation.valid) {
          logger.logSecurity('document_upload_rejected', 'warn', {
            error: documentValidation.error,
            userId: message.from?.id,
            fileName: message.document.file_name,
            mimeType: message.document.mime_type,
            ip: req.ip
          });

          return res.status(400).json({
            error: 'Invalid document',
            details: documentValidation.error
          });
        }
      }

      next();

    } catch (error) {
      logger.error('Media validation error:', error);
      res.status(500).json({ error: 'Media validation error' });
    }
  }

  /**
   * Validate photo upload array
   * @param {Array} photos - Array of photo objects
   * @returns {Object} - Validation result
   */
  validatePhotoUpload(photos) {
    if (!Array.isArray(photos) || photos.length === 0) {
      return { valid: false, error: 'Photo array is empty or invalid' };
    }

    // Check each photo in the array
    for (const photo of photos) {
      // Validate file ID
      const fileIdValidation = validators.isValidFileId(photo.file_id);
      if (!fileIdValidation.valid) {
        return { valid: false, error: `Invalid photo file ID: ${fileIdValidation.error}` };
      }

      // Check dimensions
      if (!photo.width || !photo.height) {
        return { valid: false, error: 'Photo missing dimensions' };
      }

      if (photo.width < VALIDATION.MIN_IMAGE_WIDTH || photo.height < VALIDATION.MIN_IMAGE_HEIGHT) {
        return { 
          valid: false, 
          error: `Photo too small: ${photo.width}x${photo.height}. Minimum: ${VALIDATION.MIN_IMAGE_WIDTH}x${VALIDATION.MIN_IMAGE_HEIGHT}` 
        };
      }

      // Check file size if provided
      if (photo.file_size && photo.file_size > CONFIG.MAX_IMAGE_SIZE) {
        return { 
          valid: false, 
          error: `Photo file too large: ${photo.file_size} bytes. Maximum: ${CONFIG.MAX_IMAGE_SIZE} bytes` 
        };
      }

      // Check aspect ratio
      const aspectRatio = photo.width / photo.height;
      if (aspectRatio > VALIDATION.MAX_IMAGE_ASPECT_RATIO || aspectRatio < (1 / VALIDATION.MAX_IMAGE_ASPECT_RATIO)) {
        return { 
          valid: false, 
          error: `Photo aspect ratio too extreme: ${aspectRatio.toFixed(2)}. Maximum: ${VALIDATION.MAX_IMAGE_ASPECT_RATIO}` 
        };
      }
    }

    return { valid: true };
  }

  /**
   * Validate document uploads
   * @param {Object} document - Document object
   * @returns {Object} - Validation result
   */
  validateDocument(document) {
    // Validate file ID
    const fileIdValidation = validators.isValidFileId(document.file_id);
    if (!fileIdValidation.valid) {
      return { valid: false, error: `Invalid document file ID: ${fileIdValidation.error}` };
    }

    // Check file size
    if (document.file_size && document.file_size > CONFIG.MAX_IMAGE_SIZE) {
      return { 
        valid: false, 
        error: `Document too large: ${document.file_size} bytes. Maximum: ${CONFIG.MAX_IMAGE_SIZE} bytes` 
      };
    }

    // Check MIME type if provided
    if (document.mime_type && !VALIDATION.ALLOWED_MIME_TYPES.includes(document.mime_type)) {
      return { 
        valid: false, 
        error: `Unsupported file type: ${document.mime_type}. Allowed: ${VALIDATION.ALLOWED_MIME_TYPES.join(', ')}` 
      };
    }

    // Validate file name if provided
    if (document.file_name) {
      const sanitizedName = validators.sanitizeText(document.file_name);
      if (sanitizedName !== document.file_name) {
        document.file_name = sanitizedName;
      }
    }

    return { valid: true };
  }

  /**
   * Validate API request parameters
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  validateApiRequest(req, res, next) {
    try {
      // Validate query parameters
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          const sanitizedValue = validators.sanitizeText(String(value));
          if (sanitizedValue !== value) {
            req.query[key] = sanitizedValue;
            logger.logSecurity('query_param_sanitized', 'info', {
              param: key,
              originalValue: String(value).substring(0, 100),
              sanitizedValue: sanitizedValue.substring(0, 100),
              ip: req.ip
            });
          }
        }
      }

      // Validate common parameters
      if (req.params.userId) {
        const userIdValidation = validators.isValidUserId(req.params.userId);
        if (!userIdValidation.valid) {
          return res.status(400).json({
            error: 'Invalid user ID parameter',
            details: userIdValidation.error
          });
        }
      }

      if (req.params.chatId) {
        const chatIdValidation = validators.isValidChatId(req.params.chatId);
        if (!chatIdValidation.valid) {
          return res.status(400).json({
            error: 'Invalid chat ID parameter',
            details: chatIdValidation.error
          });
        }
      }

      next();

    } catch (error) {
      logger.error('API request validation error:', error);
      res.status(500).json({ error: 'Request validation error' });
    }
  }

  /**
   * Validate request headers
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  validateRequestHeaders(req, res, next) {
    try {
      const requiredHeaders = ['content-type'];
      const suspiciousHeaders = ['x-forwarded-host', 'x-real-ip'];

      // Check required headers for POST requests
      if (req.method === 'POST') {
        for (const header of requiredHeaders) {
          if (!req.get(header)) {
            logger.logSecurity('missing_required_header', 'warn', {
              header,
              method: req.method,
              path: req.path,
              ip: req.ip
            });
          }
        }
      }

      // Check for suspicious headers
      for (const header of suspiciousHeaders) {
        if (req.get(header)) {
          logger.logSecurity('suspicious_header_detected', 'warn', {
            header,
            value: req.get(header),
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });
        }
      }

      // Validate User-Agent
      const userAgent = req.get('User-Agent');
      if (userAgent) {
        const sanitizedUA = validators.sanitizeText(userAgent);
        if (sanitizedUA !== userAgent) {
          logger.logSecurity('user_agent_sanitized', 'info', {
            original: userAgent.substring(0, 200),
            sanitized: sanitizedUA.substring(0, 200),
            ip: req.ip
          });
        }
      }

      next();

    } catch (error) {
      logger.error('Header validation error:', error);
      res.status(500).json({ error: 'Header validation error' });
    }
  }

  /**
   * Create comprehensive validation middleware chain
   * @returns {Array} - Array of middleware functions
   */
  createWebhookValidationMiddleware() {
    return [
      this.validateRequestHeaders.bind(this),
      this.validateWebhookPayload.bind(this),
      this.validateMediaUpload.bind(this)
    ];
  }

  /**
   * Create API validation middleware chain
   * @returns {Array} - Array of middleware functions
   */
  createApiValidationMiddleware() {
    return [
      this.validateRequestHeaders.bind(this),
      this.validateApiRequest.bind(this)
    ];
  }
}

// Export singleton instance
module.exports = new ValidationMiddleware();