/**
 * Telegram Bot API Service
 * Handles all interactions with Telegram Bot API
 */

const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const validators = require('../utils/validators');

class TelegramService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!this.botToken || this.botToken === 'your_telegram_bot_token') {
      logger.warn('Telegram bot token not configured');
      this.bot = null;
      return;
    }

    // Initialize bot without polling (we use webhooks)
    this.bot = new TelegramBot(this.botToken, { polling: false });
    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    
    logger.info('TelegramService initialized successfully');
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured() {
    return this.bot !== null;
  }

  /**
   * Send message to a chat
   * @param {number} chatId - Chat ID to send message to
   * @param {string} text - Message text
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} - Message object from Telegram
   */
  async sendMessage(chatId, text, options = {}) {
    if (!this.isConfigured()) {
      throw errorHandler.createError('Telegram service not configured', 'ConfigurationError', 500);
    }

    // Validate inputs
    const chatIdValidation = validators.isValidChatId(chatId);
    if (!chatIdValidation.valid) {
      throw errorHandler.createError(chatIdValidation.error, 'ValidationError', 400);
    }

    if (!text || typeof text !== 'string') {
      throw errorHandler.createError('Message text is required', 'ValidationError', 400);
    }

    if (text.length > 4096) {
      throw errorHandler.createError('Message text too long (max 4096 characters)', 'ValidationError', 400);
    }

    const startTime = Date.now();
    
    try {
      // Default options for messages
      const defaultOptions = {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        disable_notification: false
      };

      const messageOptions = { ...defaultOptions, ...options };

      logger.info(`Sending message to chat ${chatId}`, {
        textLength: text.length,
        parseMode: messageOptions.parse_mode,
        hasReplyMarkup: !!messageOptions.reply_markup
      });

      const result = await errorHandler.safeExecuteWithRetries(
        async () => await this.bot.sendMessage(chatId, text, messageOptions),
        null,
        2
      );
      
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'sendMessage', duration, true);
      
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'sendMessage', duration, false);
      
      const telegramError = errorHandler.handleTelegramError(error, {
        chatId,
        textLength: text.length,
        method: 'sendMessage'
      });
      
      throw telegramError;
    }
  }

  /**
   * Get file URL by file ID
   * @param {string} fileId - Telegram file ID
   * @returns {Promise<string>} - File URL
   */
  async getFile(fileId) {
    if (!this.isConfigured()) {
      throw errorHandler.createError('Telegram service not configured', 'ConfigurationError', 500);
    }

    // Validate file ID
    const fileIdValidation = validators.isValidFileId(fileId);
    if (!fileIdValidation.valid) {
      throw errorHandler.createError(fileIdValidation.error, 'ValidationError', 400);
    }

    const startTime = Date.now();

    try {
      logger.info(`Getting file info for file ID: ${fileId}`);

      const file = await errorHandler.safeExecuteWithRetries(
        async () => await this.bot.getFile(fileId),
        null,
        2
      );
      const fileUrl = `https://api.telegram.org/file/bot${this.botToken}/${file.file_path}`;
      
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getFile', duration, true);
      
      logger.info(`File URL obtained: ${fileUrl}`);
      return fileUrl;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getFile', duration, false);
      
      const telegramError = errorHandler.handleTelegramError(error, {
        fileId,
        method: 'getFile'
      });
      
      throw telegramError;
    }
  }

  /**
   * Set webhook URL for receiving updates
   * @param {string} webhookUrl - Full webhook URL
   * @param {Object} options - Additional webhook options
   * @returns {Promise<boolean>} - Success status
   */
  async setWebhook(webhookUrl, options = {}) {
    if (!this.isConfigured()) {
      throw errorHandler.createError('Telegram service not configured', 'ConfigurationError', 500);
    }

    // Validate webhook URL
    const urlValidation = validators.isValidUrl(webhookUrl);
    if (!urlValidation.valid) {
      throw errorHandler.createError(urlValidation.error, 'ValidationError', 400);
    }

    const startTime = Date.now();

    try {
      logger.info(`Setting webhook to: ${webhookUrl}`);

      const webhookOptions = {
        url: webhookUrl,
        allowed_updates: ['message', 'callback_query'],
        drop_pending_updates: true,
        ...options
      };

      const result = await errorHandler.safeExecuteWithRetries(
        async () => await this.bot.setWebHook(webhookUrl, webhookOptions),
        null,
        2
      );
      
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'setWebHook', duration, true);
      
      if (result) {
        logger.info('Webhook set successfully');
        return true;
      } else {
        throw new Error('Failed to set webhook - unknown error');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'setWebHook', duration, false);
      
      const telegramError = errorHandler.handleTelegramError(error, {
        webhookUrl,
        method: 'setWebHook'
      });
      
      throw telegramError;
    }
  }

  /**
   * Get current webhook info
   * @returns {Promise<Object>} - Webhook info
   */
  async getWebhookInfo() {
    if (!this.isConfigured()) {
      throw errorHandler.createError('Telegram service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      logger.info('Getting webhook info');

      const response = await axios.get(`${this.apiUrl}/getWebhookInfo`);
      
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getWebhookInfo', duration, true);
      
      return response.data.result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getWebhookInfo', duration, false);
      
      const telegramError = errorHandler.handleTelegramError(error, {
        method: 'getWebhookInfo'
      });
      
      throw telegramError;
    }
  }

  /**
   * Delete webhook (set to empty URL)
   * @returns {Promise<boolean>} - Success status
   */
  async deleteWebhook() {
    if (!this.isConfigured()) {
      throw errorHandler.createError('Telegram service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      logger.info('Deleting webhook');

      const result = await this.bot.deleteWebHook();
      
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'deleteWebHook', duration, true);
      
      if (result) {
        logger.info('Webhook deleted successfully');
        return true;
      } else {
        throw new Error('Failed to delete webhook - unknown error');
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'deleteWebHook', duration, false);
      
      const telegramError = errorHandler.handleTelegramError(error, {
        method: 'deleteWebHook'
      });
      
      throw telegramError;
    }
  }

  /**
   * Get bot information
   * @returns {Promise<Object>} - Bot info
   */
  async getMe() {
    if (!this.isConfigured()) {
      throw errorHandler.createError('Telegram service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      logger.info('Getting bot information');

      const botInfo = await this.bot.getMe();
      
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getMe', duration, true);
      
      return botInfo;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getMe', duration, false);
      
      const telegramError = errorHandler.handleTelegramError(error, {
        method: 'getMe'
      });
      
      throw telegramError;
    }
  }

  /**
   * Send typing action (shows "Bot is typing...")
   * @param {number} chatId - Chat ID
   * @returns {Promise<boolean>} - Success status
   */
  async sendChatAction(chatId, action = 'typing') {
    if (!this.isConfigured()) {
      throw errorHandler.createError('Telegram service not configured', 'ConfigurationError', 500);
    }

    try {
      await this.bot.sendChatAction(chatId, action);
      return true;
    } catch (error) {
      // Don't throw errors for chat actions - they're not critical
      logger.warn(`Failed to send chat action ${action} to ${chatId}:`, error.message);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new TelegramService();