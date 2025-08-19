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

      const requestData = new URLSearchParams();
      requestData.append('user_id', userId.toString());
      requestData.append('name', packName);
      requestData.append('title', title);
      requestData.append('sticker_type', 'regular');
      
      // Correct format for stickers array
      const stickersArray = [{
        sticker: firstStickerFileId,
        emoji_list: [emoji],
        format: 'static'
      }];
      requestData.append('stickers', JSON.stringify(stickersArray));

      logger.info(`Creating sticker set with data:`, {
        userId,
        packName,
        title,
        firstStickerFileId,
        emoji,
        stickerFormat: 'static',
        stickerType: 'regular'
      });

      const response = await axios.post(`${this.apiUrl}/createNewStickerSet`, requestData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }).catch(error => {
        logger.error(`Telegram API createNewStickerSet Error Details:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          telegramErrorDescription: error.response?.data?.description,
          telegramErrorCode: error.response?.data?.error_code,
          userId,
          packName,
          firstStickerFileId,
          emoji
        });
        throw error;
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
   * Add sticker to existing sticker set with retry logic
   * @param {number} userId - User ID
   * @param {string} packName - Pack name to add sticker to
   * @param {string} stickerFileId - File ID of the sticker
   * @param {string} emoji - Emoji for the sticker
   * @param {number} maxRetries - Maximum number of retry attempts
   * @returns {Promise<boolean>} - Success status
   */
  async addStickerToSet(userId, packName, stickerFileId, emoji = '😄', maxRetries = 3) {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Sticker service not configured', 'ConfigurationError', 500);
    }

    if (!userId || !packName || !stickerFileId) {
      throw errorHandler.createError('User ID, pack name, and sticker file ID are required', 'ValidationError', 400);
    }

    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        logger.info(`Adding sticker to set: ${packName} (attempt ${attempt}/${maxRetries})`, {
          userId,
          packName,
          stickerFileId,
          emoji,
          attempt
        });

        // Validate inputs according to Telegram Bot API requirements
        if (!stickerFileId || typeof stickerFileId !== 'string' || stickerFileId.length < 10) {
          throw new Error(`Invalid sticker file ID: ${stickerFileId}`);
        }
        
        if (!emoji || typeof emoji !== 'string' || emoji.length === 0) {
          throw new Error(`Invalid emoji: ${emoji}`);
        }
        
        const requestData = new URLSearchParams();
        requestData.append('user_id', userId.toString());
        requestData.append('name', packName);
        
        // InputSticker object according to Telegram Bot API docs
        const inputSticker = {
          sticker: stickerFileId,
          emoji_list: [emoji],
          format: 'static'
        };
        
        // Try different approaches based on attempt number
        if (attempt === 1) {
          // Official approach: InputSticker as JSON string
          requestData.append('sticker', JSON.stringify(inputSticker));
        } else if (attempt === 2) {
          // Alternative: try multipart/form-data structure
          requestData.append('sticker', stickerFileId);
          requestData.append('emoji_list', JSON.stringify([emoji]));
          requestData.append('format', 'static');
        } else {
          // Last attempt: simplified InputSticker without format
          const simplifiedSticker = {
            sticker: stickerFileId,
            emoji_list: [emoji]
          };
          requestData.append('sticker', JSON.stringify(simplifiedSticker));
        }

        // Detailed logging for debugging HTTP 400 errors
        const requestDataEntries = Array.from(requestData.entries());
        logger.info(`Request payload details (attempt ${attempt}):`, {
          userId,
          packName,
          stickerFileId,
          emoji,
          inputSticker,
          requestDataEntries,
          requestFormat: attempt === 1 ? 'INPUTSTICKER_JSON' : attempt === 2 ? 'FORM_DATA_FIELDS' : 'SIMPLIFIED_JSON',
          attempt
        });

        const response = await axios.post(`${this.apiUrl}/addStickerToSet`, requestData, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 30000
        }).catch(error => {
          // Enhanced error logging for HTTP 400 debugging
          const errorDetails = {
            status: error.response?.status,
            statusText: error.response?.statusText,
            data: error.response?.data,
            headers: error.response?.headers,
            requestDataString: requestData.toString(),
            url: `${this.apiUrl}/addStickerToSet`,
            attempt,
            userId,
            packName,
            stickerFileId,
            emoji,
            errorMessage: error.message,
            errorCode: error.code,
            telegramErrorDescription: error.response?.data?.description,
            telegramErrorCode: error.response?.data?.error_code,
            requestPayloadSize: requestData.toString().length
          };
          
          logger.error(`Telegram API addStickerToSet Error Details:`, errorDetails);
          
          // Also log to console for immediate debugging
          console.error(`[TELEGRAM API ERROR] addStickerToSet failed:`, {
            attempt,
            status: error.response?.status,
            telegramError: error.response?.data?.description,
            stickerFileId,
            emoji
          });
          
          throw error;
        });

        const duration = Date.now() - startTime;
        logger.logApiCall('Telegram', 'addStickerToSet', duration, true);

        if (!response.data.ok) {
          const telegramError = response.data.description || 'Unknown Telegram error';
          const errorCode = response.data.error_code;
          
          // Log specific Telegram error for debugging
          logger.error(`Telegram API returned error:`, {
            description: telegramError,
            error_code: errorCode,
            packName,
            stickerFileId,
            emoji,
            attempt
          });
          
          throw new Error(`Telegram API error [${errorCode}]: ${telegramError}`);
        }

        logger.info(`Sticker added to set successfully: ${packName}`, {
          userId,
          packName,
          stickerFileId,
          duration,
          attempt
        });

        return true;

      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logApiCall('Telegram', 'addStickerToSet', duration, false);
        
        lastError = error;
        
        // Check for specific Telegram errors and adjust strategy
        const errorMessage = error.message || '';
        const responseData = error.response?.data;
        const telegramError = responseData?.description || '';
        
        const isEmojiError = errorMessage.includes('emoji') || errorMessage.includes('STICKER_EMOJI_INVALID');
        const isFileError = errorMessage.includes('file') || errorMessage.includes('STICKER_INVALID');
        const isDuplicateError = errorMessage.includes('duplicate') || errorMessage.includes('already exists');
        const isStickerSetInvalid = telegramError.includes('STICKERSET_INVALID');
        
        logger.error(`Failed to add sticker to set: ${packName} (attempt ${attempt}/${maxRetries})`, {
          userId,
          packName,
          stickerFileId,
          error: error.message,
          telegramError,
          attempt,
          duration,
          isEmojiError,
          isFileError,
          isDuplicateError,
          isStickerSetInvalid,
          errorType: isStickerSetInvalid ? 'STICKERSET_INVALID' : isEmojiError ? 'EMOJI' : isFileError ? 'FILE' : isDuplicateError ? 'DUPLICATE' : 'UNKNOWN'
        });
        
        // If sticker set is invalid, no point in retrying
        if (isStickerSetInvalid) {
          logger.error(`STICKERSET_INVALID error detected - stopping all retries for pack: ${packName}`);
          throw new Error(`Sticker set is invalid and cannot be modified: ${packName}`);
        }
        
        // For emoji errors, try with a different emoji in next attempt
        if (isEmojiError && attempt < maxRetries) {
          const fallbackEmojis = ['😀', '😃', '😄', '😁', '😆'];
          emoji = fallbackEmojis[(attempt - 1) % fallbackEmojis.length];
          logger.info(`Emoji error detected, switching to fallback emoji: ${emoji} for next attempt`);
        }
        
        // If this is not the last attempt, wait before retrying
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Exponential backoff, max 5 seconds
          logger.info(`Waiting ${delay}ms before retry attempt ${attempt + 1}`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All retries failed
    logger.error(`Failed to add sticker to set after ${maxRetries} attempts: ${packName}`, {
      userId,
      packName,
      stickerFileId,
      finalError: lastError.message
    });
    
    const telegramError = errorHandler.handleTelegramError(lastError, {
      userId,
      packName,
      stickerFileId,
      method: 'addStickerToSet',
      attempts: maxRetries
    });

    throw telegramError;
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
    const maxStickerSetRetries = 2; // Maximum attempts to recreate sticker set
    
    for (let stickerSetAttempt = 1; stickerSetAttempt <= maxStickerSetRetries; stickerSetAttempt++) {
      logger.info(`Creating sticker set attempt ${stickerSetAttempt}/${maxStickerSetRetries}`);
      
      try {
        return await this._createStickerSetAttempt(userId, stickerBuffers, emojis, title, startTime, stickerSetAttempt);
      } catch (error) {
        const isStickerSetError = error.message.includes('STICKERSET_INVALID') || 
                                error.message.includes('Multiple STICKERSET_INVALID errors');
        
        if (isStickerSetError && stickerSetAttempt < maxStickerSetRetries) {
          logger.warn(`Sticker set creation failed (attempt ${stickerSetAttempt}), retrying with new pack name...`, {
            error: error.message,
            nextAttempt: stickerSetAttempt + 1
          });
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 3000));
          continue;
        }
        
        throw error;
      }
    }
  }

  async _createStickerSetAttempt(userId, stickerBuffers, emojis, title, startTime, attempt) {
    try {
      if (!userId || !Array.isArray(stickerBuffers) || stickerBuffers.length === 0) {
        throw errorHandler.createError('User ID and sticker buffers array are required', 'ValidationError', 400);
      }

      if (!Array.isArray(emojis) || emojis.length !== stickerBuffers.length) {
        throw errorHandler.createError('Emojis array must match stickers count', 'ValidationError', 400);
      }

      // Generate unique pack name for each attempt
      const packName = this.generatePackName(userId) + (attempt > 1 ? `_retry${attempt}` : '');
      
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

      // Wait for Telegram to process the sticker set creation
      logger.info(`Waiting for Telegram to process sticker set creation: ${packName}`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay

      // Verify sticker set was created successfully before adding more stickers
      try {
        const verificationResult = await this.getStickerSet(packName);
        logger.info(`Sticker set verification successful: ${packName}`, {
          initialStickerCount: verificationResult.stickers?.length || 0,
          setTitle: verificationResult.title
        });
      } catch (verifyError) {
        logger.error(`Failed to verify sticker set creation: ${packName}`, verifyError);
        throw new Error(`Sticker set verification failed: ${verifyError.message}`);
      }

      // Add remaining stickers to the set with improved error handling
      const failedStickers = [];
      const stickerSetInvalidErrors = [];
      const fallbackEmojis = ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙'];
      
      if (fileIds.length > 1) {
        logger.info(`Adding ${fileIds.length - 1} remaining stickers to set: ${packName}`);
        
        for (let i = 1; i < fileIds.length; i++) {
          logger.info(`Adding sticker ${i + 1}/${fileIds.length} to set: ${packName}`);
          
          try {
            await this.addStickerToSet(userId, packName, fileIds[i], emojis[i]);
          } catch (error) {
            const isStickerSetInvalid = error.message.includes('STICKERSET_INVALID');
            
            if (isStickerSetInvalid) {
              stickerSetInvalidErrors.push({
                stickerIndex: i + 1,
                fileId: fileIds[i],
                error: error.message
              });
            }
            
            logger.error(`Failed to add sticker ${i + 1}/${fileIds.length}, adding to retry list:`, {
              error: error.message,
              stickerIndex: i,
              fileId: fileIds[i],
              originalEmoji: emojis[i],
              isStickerSetInvalid
            });
            
            failedStickers.push({
              index: i,
              fileId: fileIds[i],
              originalEmoji: emojis[i],
              error: error.message
            });
          }
          
          // Add delay between sticker additions to avoid race conditions
          if (i < fileIds.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // 1.5 second delay
          }
        }
        
        // Check for multiple STICKERSET_INVALID errors - indicates the set needs to be recreated
        if (stickerSetInvalidErrors.length >= 2) {
          logger.error(`Multiple STICKERSET_INVALID errors detected (${stickerSetInvalidErrors.length}), sticker set is fundamentally broken:`, {
            packName,
            stickerSetInvalidErrors,
            attempt
          });
          throw new Error(`Multiple STICKERSET_INVALID errors detected: sticker set ${packName} is invalid and needs recreation`);
        }
        
        // Retry failed stickers with fallback emojis
        if (failedStickers.length > 0) {
          logger.info(`Retrying ${failedStickers.length} failed stickers with fallback emojis`);
          
          for (const failedSticker of failedStickers) {
            let success = false;
            
            // Try with multiple fallback emojis
            for (let emojiAttempt = 0; emojiAttempt < 5 && !success; emojiAttempt++) {
              const fallbackEmoji = fallbackEmojis[emojiAttempt % fallbackEmojis.length];
              
              try {
                logger.info(`Retrying sticker ${failedSticker.index + 1} with fallback emoji: ${fallbackEmoji}`);
                await this.addStickerToSet(userId, packName, failedSticker.fileId, fallbackEmoji);
                success = true;
                logger.info(`Successfully added sticker ${failedSticker.index + 1} with fallback emoji: ${fallbackEmoji}`);
              } catch (retryError) {
                logger.warn(`Fallback emoji ${fallbackEmoji} also failed for sticker ${failedSticker.index + 1}:`, retryError.message);
              }
              
              // Small delay between emoji attempts
              if (!success && emojiAttempt < 4) {
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
            
            if (!success) {
              logger.error(`Failed to add sticker ${failedSticker.index + 1} even with fallback emojis`);
            }
          }
        }
        
        logger.info(`Sticker addition process completed for set: ${packName}`);
      }

      const packUrl = this.generateStickerPackUrl(packName);
      
      // Verify the sticker pack was created successfully
      logger.info(`Getting sticker set info: ${packName}`);
      const stickerSetInfo = await this.getStickerSet(packName);
      
      const duration = Date.now() - startTime;
      const actualStickers = stickerSetInfo.stickers?.length || 0;
      const requestedStickers = fileIds.length;

      // Log discrepancy if any stickers are missing
      if (actualStickers !== requestedStickers) {
        logger.warn(`Sticker count mismatch for pack ${packName}:`, {
          requested: requestedStickers,
          actual: actualStickers,
          missing: requestedStickers - actualStickers,
          failedStickers: failedStickers.length
        });
      }

      logger.info(`Complete sticker pack created: ${packName}`, {
        userId,
        packName,
        packUrl,
        requestedStickers,
        actualStickers,
        success: actualStickers === requestedStickers,
        duration
      });

      return {
        packName,
        packUrl,
        stickerCount: actualStickers,
        requestedStickers,
        actualStickers,
        success: actualStickers === requestedStickers,
        failedStickers: failedStickers.length,
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