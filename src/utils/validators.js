/**
 * Data validation utility
 * Provides validation functions for user inputs and API data
 */

const { CONFIG } = require('../config/constants');
const logger = require('./logger');

class Validators {
  /**
   * Validate user ID (Telegram user ID)
   */
  isValidUserId(userId) {
    if (!userId) {
      return { valid: false, error: 'User ID is required' };
    }

    // Telegram user IDs are positive 64-bit integers
    const numericId = parseInt(userId, 10);
    if (isNaN(numericId) || numericId <= 0 || numericId > Number.MAX_SAFE_INTEGER) {
      return { valid: false, error: 'Invalid user ID format' };
    }

    return { valid: true };
  }

  /**
   * Validate chat ID (Telegram chat ID)
   */
  isValidChatId(chatId) {
    if (!chatId) {
      return { valid: false, error: 'Chat ID is required' };
    }

    // Chat IDs can be negative (for groups) or positive (for users) - 64-bit integers
    const numericId = parseInt(chatId, 10);
    if (isNaN(numericId) || Math.abs(numericId) > Number.MAX_SAFE_INTEGER) {
      return { valid: false, error: 'Invalid chat ID format' };
    }

    return { valid: true };
  }

  /**
   * Validate photo array from Telegram
   */
  isValidPhotoArray(photos) {
    if (!photos || !Array.isArray(photos)) {
      return { valid: false, error: 'Photos array is required' };
    }

    if (photos.length === 0) {
      return { valid: false, error: 'Photos array cannot be empty' };
    }

    // Check each photo object
    for (const photo of photos) {
      if (!photo.file_id || typeof photo.file_id !== 'string') {
        return { valid: false, error: 'Invalid photo file_id' };
      }

      if (!photo.width || !photo.height || photo.width <= 0 || photo.height <= 0) {
        return { valid: false, error: 'Invalid photo dimensions' };
      }

      // Optional: Check file size if provided
      if (photo.file_size && photo.file_size > CONFIG.MAX_IMAGE_SIZE) {
        return { valid: false, error: 'Photo file is too large' };
      }
    }

    return { valid: true };
  }

  /**
   * Validate URL format (including data URLs for Piapi)
   */
  isValidUrl(url) {
    if (!url || typeof url !== 'string') {
      return { valid: false, error: 'URL is required and must be a string' };
    }

    // Check for data URLs (base64 encoded images for Piapi)
    if (url.startsWith('data:')) {
      // Validate data URL format: data:[mediatype][;base64],data
      const dataUrlPattern = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+)(;base64)?,(.+)$/;
      if (!dataUrlPattern.test(url)) {
        return { valid: false, error: 'Invalid data URL format' };
      }
      
      // Check if it's an image data URL
      const [, mediaType] = url.match(dataUrlPattern);
      if (!mediaType.startsWith('image/')) {
        return { valid: false, error: 'Data URL must be an image type' };
      }
      
      return { valid: true };
    }

    try {
      const urlObj = new URL(url);
      
      // Check for valid protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { valid: false, error: 'URL must use HTTP or HTTPS protocol' };
      }

      // Check for valid hostname
      if (!urlObj.hostname || urlObj.hostname.length === 0) {
        return { valid: false, error: 'URL must have a valid hostname' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  /**
   * Validate file ID from Telegram
   */
  isValidFileId(fileId) {
    if (!fileId || typeof fileId !== 'string') {
      return { valid: false, error: 'File ID is required and must be a string' };
    }

    // Telegram file IDs are typically alphanumeric with some special characters
    if (fileId.length < 10 || fileId.length > 200) {
      return { valid: false, error: 'File ID has invalid length' };
    }

    // Basic pattern check (Telegram file IDs are base64-like)
    if (!/^[A-Za-z0-9_-]+$/.test(fileId)) {
      return { valid: false, error: 'File ID has invalid characters' };
    }

    return { valid: true };
  }

  /**
   * Validate webhook payload from Telegram
   */
  isValidWebhookPayload(payload) {
    if (!payload || typeof payload !== 'object') {
      return { valid: false, error: 'Webhook payload must be an object' };
    }

    if (!payload.update_id || typeof payload.update_id !== 'number') {
      return { valid: false, error: 'Update ID is required' };
    }

    // Check if payload has at least one of the expected fields
    const expectedFields = ['message', 'edited_message', 'callback_query', 'inline_query'];
    const hasValidField = expectedFields.some(field => payload[field]);
    
    if (!hasValidField) {
      return { valid: false, error: 'Webhook payload missing expected fields' };
    }

    return { valid: true };
  }

  /**
   * Validate message object from Telegram
   */
  isValidTelegramMessage(message) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Message must be an object' };
    }

    if (!message.message_id || typeof message.message_id !== 'number') {
      return { valid: false, error: 'Message ID is required' };
    }

    if (!message.from || typeof message.from !== 'object') {
      return { valid: false, error: 'Message sender (from) is required' };
    }

    if (!message.chat || typeof message.chat !== 'object') {
      return { valid: false, error: 'Message chat is required' };
    }

    if (!message.date || typeof message.date !== 'number') {
      return { valid: false, error: 'Message date is required' };
    }

    return { valid: true };
  }

  /**
   * Sanitize text input
   */
  sanitizeText(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    return text
      .trim()
      .replace(/[\x00-\x1f\x7f]/g, '') // Remove control characters
      .replace(/[<>]/g, '') // Remove potential HTML tags
      .substring(0, 1000); // Limit length
  }

  /**
   * Validate image buffer
   */
  isValidImageBuffer(buffer) {
    if (!Buffer.isBuffer(buffer)) {
      return { valid: false, error: 'Image data must be a Buffer' };
    }

    if (buffer.length === 0) {
      return { valid: false, error: 'Image buffer cannot be empty' };
    }

    if (buffer.length > CONFIG.MAX_IMAGE_SIZE) {
      return { valid: false, error: `Image too large. Max size: ${CONFIG.MAX_IMAGE_SIZE} bytes` };
    }

    // Check for common image file signatures
    const signatures = {
      'image/jpeg': [0xFF, 0xD8, 0xFF],
      'image/png': [0x89, 0x50, 0x4E, 0x47],
      'image/webp': [0x52, 0x49, 0x46, 0x46] // RIFF header for WebP
    };

    let detectedFormat = null;
    for (const [format, signature] of Object.entries(signatures)) {
      if (signature.every((byte, index) => buffer[index] === byte)) {
        detectedFormat = format;
        break;
      }
    }

    if (!detectedFormat) {
      return { valid: false, error: 'Unsupported image format' };
    }

    return { valid: true, format: detectedFormat };
  }

  /**
   * Validate sticker pack name
   */
  isValidStickerPackName(packName) {
    if (!packName || typeof packName !== 'string') {
      return { valid: false, error: 'Sticker pack name is required' };
    }

    // Telegram sticker pack naming rules
    if (packName.length < 1 || packName.length > 64) {
      return { valid: false, error: 'Sticker pack name must be 1-64 characters' };
    }

    // Must contain only letters, digits and underscores
    if (!/^[a-zA-Z0-9_]+$/.test(packName)) {
      return { valid: false, error: 'Sticker pack name can only contain letters, numbers and underscores' };
    }

    // Must end with "_by_<bot_username>"
    if (!packName.includes('_by_')) {
      return { valid: false, error: 'Sticker pack name must include bot username' };
    }

    return { valid: true };
  }

  /**
   * Validate emoji for sticker
   */
  isValidEmoji(emoji) {
    if (!emoji || typeof emoji !== 'string') {
      return { valid: false, error: 'Emoji is required' };
    }

    // Basic emoji validation (this is simplified)
    // In practice, you might want to use a more comprehensive emoji validation library
    const emojiRegex = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    
    if (!emojiRegex.test(emoji)) {
      return { valid: false, error: 'Invalid emoji format' };
    }

    if (emoji.length > 4) { // Some emojis can be compound
      return { valid: false, error: 'Emoji is too long' };
    }

    return { valid: true };
  }

  /**
   * Validate processing timeout
   */
  isValidTimeout(timeout) {
    const numericTimeout = parseInt(timeout, 10);
    
    if (isNaN(numericTimeout) || numericTimeout <= 0) {
      return { valid: false, error: 'Timeout must be a positive number' };
    }

    if (numericTimeout > CONFIG.MAX_PROCESSING_TIME) {
      return { valid: false, error: `Timeout too large. Max: ${CONFIG.MAX_PROCESSING_TIME}ms` };
    }

    return { valid: true, value: numericTimeout };
  }

  /**
   * Comprehensive validation helper
   */
  validateAll(validations) {
    const errors = [];
    
    for (const [field, value, validatorName, ...args] of validations) {
      if (typeof this[validatorName] === 'function') {
        const result = this[validatorName](value, ...args);
        if (!result.valid) {
          errors.push(`${field}: ${result.error}`);
        }
      } else {
        errors.push(`${field}: Unknown validator "${validatorName}"`);
      }
    }

    if (errors.length > 0) {
      logger.warn('Validation failed:', { errors, validations: validations.map(v => v[0]) });
      return { valid: false, errors };
    }

    return { valid: true };
  }

  /**
   * Log validation failure for monitoring
   */
  logValidationFailure(field, value, error, context = {}) {
    logger.logSecurity('validation_failure', 'warn', {
      field,
      error,
      valueType: typeof value,
      valueLength: value?.length || 0,
      ...context
    });
  }
}

// Export singleton instance
module.exports = new Validators();