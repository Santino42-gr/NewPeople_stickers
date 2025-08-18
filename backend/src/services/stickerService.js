/**
 * Sticker Service
 * Handles all interactions with Telegram Bot API for sticker pack management
 */

const axios = require('axios');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

class StickerService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!this.botToken || this.botToken === 'your_telegram_bot_token') {
      logger.warn('Telegram bot token not configured for StickerService');
      this.isConfigured = false;
      return;
    }

    this.apiUrl = `https://api.telegram.org/bot${this.botToken}`;
    this.isConfigured = true;
    
    logger.info('StickerService initialized successfully');
  }

  /**
   * Check if the service is properly configured
   */
  isServiceConfigured() {
    return this.isConfigured;
  }

  /**
   * Generate unique sticker pack name for a user
   * @param {number} userId - Telegram user ID
   * @returns {string} - Unique pack name
   */
  generatePackName(userId) {
    // Generate unique pack name using user ID and timestamp
    const timestamp = Date.now().toString().slice(-8); // Last 8 digits
    const randomSuffix = Math.random().toString(36).substring(2, 8); // Random 6 chars
    
    const packName = `newpeople_${userId}_${timestamp}_${randomSuffix}_by_NewPeopleStickersBot`;
    
    logger.info(`Generated pack name: ${packName}`, { userId });
    return packName;
  }

  /**
   * Upload sticker file to Telegram
   * @param {number} userId - User ID for the sticker
   * @param {Buffer} imageBuffer - Image data as buffer (WebP format)
   * @returns {Promise<string>} - File ID from Telegram
   */
  async uploadStickerFile(userId, imageBuffer) {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Sticker service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      if (!userId || !imageBuffer) {
        throw errorHandler.createError('User ID and image buffer are required', 'ValidationError', 400);
      }

      logger.info(`Uploading sticker file for user ${userId}`, {
        userId,
        bufferSize: imageBuffer.length
      });

      // Create form data for file upload
      const formData = new FormData();
      formData.append('user_id', userId.toString());
      
      // Create blob from buffer for browser compatibility
      const blob = new Blob([imageBuffer], { type: 'image/webp' });
      formData.append('sticker', blob, 'sticker.webp');

      const response = await axios.post(`${this.apiUrl}/uploadStickerFile`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        timeout: 30000
      });

      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'uploadStickerFile', duration, true);

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      const fileId = response.data.result.file_id;
      
      logger.info(`Sticker file uploaded successfully: ${fileId}`, {
        userId,
        fileId,
        duration
      });

      return fileId;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'uploadStickerFile', duration, false);

      const telegramError = errorHandler.handleTelegramError(error, {
        userId,
        method: 'uploadStickerFile',
        bufferSize: imageBuffer?.length
      });

      throw telegramError;
    }
  }

  /**
   * Create new sticker set with first sticker
   * @param {number} userId - User ID
   * @param {string} packName - Unique pack name
   * @param {string} firstStickerFileId - File ID of the first sticker
   * @param {string} emoji - Emoji for the sticker
   * @param {string} title - Display title for the pack
   * @returns {Promise<boolean>} - Success status
   */
  async createNewStickerSet(userId, packName, firstStickerFileId, emoji = '😄', title = 'New People Sticker Pack') {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Sticker service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      if (!userId || !packName || !firstStickerFileId) {
        throw errorHandler.createError('User ID, pack name, and sticker file ID are required', 'ValidationError', 400);
      }

      logger.info(`Creating new sticker set: ${packName}`, {
        userId,
        packName,
        firstStickerFileId,
        emoji,
        title
      });

      const requestData = {
        user_id: userId,
        name: packName,
        title: title,
        stickers: JSON.stringify([{
          sticker: firstStickerFileId,
          emoji_list: [emoji],
          format: 'static'
        }])
      };

      const response = await axios.post(`${this.apiUrl}/createNewStickerSet`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'createNewStickerSet', duration, true);

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      logger.info(`Sticker set created successfully: ${packName}`, {
        userId,
        packName,
        duration
      });

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'createNewStickerSet', duration, false);

      const telegramError = errorHandler.handleTelegramError(error, {
        userId,
        packName,
        method: 'createNewStickerSet'
      });

      throw telegramError;
    }
  }

  /**
   * Add sticker to existing sticker set
   * @param {number} userId - User ID
   * @param {string} packName - Pack name to add sticker to
   * @param {string} stickerFileId - File ID of the sticker
   * @param {string} emoji - Emoji for the sticker
   * @returns {Promise<boolean>} - Success status
   */
  async addStickerToSet(userId, packName, stickerFileId, emoji = '😄') {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Sticker service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      if (!userId || !packName || !stickerFileId) {
        throw errorHandler.createError('User ID, pack name, and sticker file ID are required', 'ValidationError', 400);
      }

      logger.info(`Adding sticker to set: ${packName}`, {
        userId,
        packName,
        stickerFileId,
        emoji
      });

      const requestData = {
        user_id: userId,
        name: packName,
        sticker: JSON.stringify({
          sticker: stickerFileId,
          emoji_list: [emoji],
          format: 'static'
        })
      };

      const response = await axios.post(`${this.apiUrl}/addStickerToSet`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      });

      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'addStickerToSet', duration, true);

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      logger.info(`Sticker added to set successfully: ${packName}`, {
        userId,
        packName,
        stickerFileId,
        duration
      });

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'addStickerToSet', duration, false);

      const telegramError = errorHandler.handleTelegramError(error, {
        userId,
        packName,
        stickerFileId,
        method: 'addStickerToSet'
      });

      throw telegramError;
    }
  }

  /**
   * Get sticker set information
   * @param {string} packName - Name of the sticker set
   * @returns {Promise<Object>} - Sticker set info
   */
  async getStickerSet(packName) {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Sticker service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      if (!packName) {
        throw errorHandler.createError('Pack name is required', 'ValidationError', 400);
      }

      logger.info(`Getting sticker set info: ${packName}`);

      const response = await axios.get(`${this.apiUrl}/getStickerSet`, {
        params: { name: packName },
        timeout: 10000
      });

      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getStickerSet', duration, true);

      if (!response.data.ok) {
        throw new Error(`Telegram API error: ${response.data.description}`);
      }

      const stickerSet = response.data.result;
      
      logger.info(`Sticker set info retrieved: ${packName}`, {
        packName,
        stickerCount: stickerSet.stickers?.length || 0,
        title: stickerSet.title
      });

      return stickerSet;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Telegram', 'getStickerSet', duration, false);

      const telegramError = errorHandler.handleTelegramError(error, {
        packName,
        method: 'getStickerSet'
      });

      throw telegramError;
    }
  }

  /**
   * Generate sticker pack URL for sharing
   * @param {string} packName - Name of the sticker pack
   * @returns {string} - URL to the sticker pack
   */
  generateStickerPackUrl(packName) {
    if (!packName) {
      throw errorHandler.createError('Pack name is required', 'ValidationError', 400);
    }

    const url = `https://t.me/addstickers/${packName}`;
    
    logger.info(`Generated sticker pack URL: ${url}`, { packName });
    
    return url;
  }

  /**
   * Complete sticker pack creation workflow
   * @param {number} userId - User ID
   * @param {Array<Buffer>} stickerBuffers - Array of sticker image buffers
   * @param {Array<string>} emojis - Array of emojis for each sticker
   * @param {string} title - Pack title
   * @returns {Promise<Object>} - Pack creation result
   */
  async createCompleteStickerPack(userId, stickerBuffers, emojis, title = 'New People Sticker Pack') {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Sticker service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();

    try {
      if (!userId || !Array.isArray(stickerBuffers) || stickerBuffers.length === 0) {
        throw errorHandler.createError('User ID and sticker buffers array are required', 'ValidationError', 400);
      }

      if (!Array.isArray(emojis) || emojis.length !== stickerBuffers.length) {
        throw errorHandler.createError('Emojis array must match stickers count', 'ValidationError', 400);
      }

      const packName = this.generatePackName(userId);
      
      logger.info(`Creating complete sticker pack: ${packName}`, {
        userId,
        packName,
        stickerCount: stickerBuffers.length,
        title
      });

      // Upload all stickers first
      const uploadPromises = stickerBuffers.map(buffer => 
        this.uploadStickerFile(userId, buffer)
      );

      const fileIds = await Promise.all(uploadPromises);
      logger.info(`All stickers uploaded: ${fileIds.length} files`, { packName });

      // Create new sticker set with first sticker
      await this.createNewStickerSet(userId, packName, fileIds[0], emojis[0], title);

      // Add remaining stickers to the set
      if (fileIds.length > 1) {
        const addPromises = fileIds.slice(1).map((fileId, index) => 
          this.addStickerToSet(userId, packName, fileId, emojis[index + 1])
        );

        await Promise.all(addPromises);
      }

      const packUrl = this.generateStickerPackUrl(packName);
      const duration = Date.now() - startTime;

      logger.info(`Complete sticker pack created successfully: ${packName}`, {
        userId,
        packName,
        packUrl,
        stickerCount: fileIds.length,
        duration
      });

      return {
        packName,
        packUrl,
        stickerCount: fileIds.length,
        fileIds,
        title
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to create complete sticker pack for user ${userId}:`, error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new StickerService();