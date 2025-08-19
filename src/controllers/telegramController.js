/**
 * Telegram bot controller
 * Handles incoming webhook requests from Telegram
 */

const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const telegramService = require('../services/telegramService');
const userLimitsService = require('../services/userLimitsService');
const piapiService = require('../services/piapiService');
const stickerService = require('../services/stickerService');
const imageService = require('../services/imageService');
const { MESSAGES, CONFIG, BOT_STATES } = require('../config/constants');
const { getAllTemplates, TEMPLATE_CONFIG, TEMPLATE_ERROR_TYPES } = require('../config/templates');

class TelegramController {
  constructor() {
    // Track user states for conversation flow
    this.userStates = new Map();
  }

  /**
   * Handle incoming webhook requests from Telegram
   */
  async handleWebhook(req, res) {
    try {
      const update = req.body;
      
      // Log incoming webhook for debugging
      logger.info('Received Telegram webhook:', {
        updateId: update.update_id,
        messageId: update.message?.message_id,
        chatId: update.message?.chat?.id,
        userId: update.message?.from?.id,
        text: update.message?.text?.substring(0, 50) + (update.message?.text?.length > 50 ? '...' : ''),
        hasPhoto: !!update.message?.photo,
        firstName: update.message?.from?.first_name,
        username: update.message?.from?.username
      });

      // Basic validation
      if (!update || typeof update !== 'object') {
        logger.warn('Invalid webhook payload received');
        return res.status(400).json({ error: 'Invalid payload' });
      }

      // Process different update types
      if (update.message) {
        await this.processMessage(update.message);
      } else if (update.callback_query) {
        logger.info('Callback query received (not implemented yet)');
        // TODO: Handle callback queries in future
      } else {
        logger.info('Unknown update type received:', Object.keys(update));
      }

      // Always respond with 200 to acknowledge receipt
      res.status(200).json({ ok: true });

    } catch (error) {
      logger.error('Webhook processing error:', error);
      
      // Still return 200 to prevent Telegram from retrying
      res.status(200).json({ 
        ok: false, 
        error: 'Internal processing error' 
      });
    }
  }

  /**
   * Process incoming message
   */
  async processMessage(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text;
    const firstName = message.from.first_name || 'Пользователь';

    logger.info(`Processing message from user ${userId} in chat ${chatId}:`, {
      messageType: text ? 'text' : (message.photo ? 'photo' : 'other'),
      text: text?.substring(0, 50)
    });

    try {
      // Check if Telegram service is configured
      if (!telegramService.isConfigured()) {
        logger.error('Telegram service not configured, cannot respond to user');
        return;
      }

      // Handle different message types
      if (text === '/start') {
        await this.handleStartCommand(chatId, firstName);
      } else if (text === '/help') {
        await this.handleHelpCommand(chatId);
      } else if (message.photo) {
        await this.handlePhotoMessage(chatId, userId, message.photo, firstName);
      } else if (text) {
        await this.handleTextMessage(chatId, text);
      } else {
        await this.handleUnsupportedMessage(chatId);
      }

    } catch (error) {
      logger.error(`Error processing message from user ${userId}:`, error);
      
      // Try to send error message to user
      try {
        await telegramService.sendMessage(chatId, MESSAGES.SERVICE_ERROR);
      } catch (sendError) {
        logger.error(`Failed to send error message to user ${userId}:`, sendError);
      }
    }
  }

  /**
   * Handle /start command
   */
  async handleStartCommand(chatId, firstName) {
    try {
      logger.info(`Handling /start command for chat ${chatId}`);
      
      // Set user state to idle
      this.userStates.set(chatId, BOT_STATES.IDLE);
      
      // Send welcome message
      await telegramService.sendMessage(chatId, MESSAGES.WELCOME);
      
      logger.info(`Welcome message sent to chat ${chatId}`);
      
    } catch (error) {
      logger.error(`Failed to handle /start command for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Handle /help command
   */
  async handleHelpCommand(chatId) {
    try {
      logger.info(`Handling /help command for chat ${chatId}`);
      
      await telegramService.sendMessage(chatId, MESSAGES.HELP);
      
      logger.info(`Help message sent to chat ${chatId}`);
      
    } catch (error) {
      logger.error(`Failed to handle /help command for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Handle photo message
   */
  async handlePhotoMessage(chatId, userId, photos, firstName) {
    try {
      logger.info(`Handling photo message for user ${userId} in chat ${chatId}`);
      
      // Check if user is already processing
      const currentState = this.userStates.get(chatId);
      if (currentState === BOT_STATES.PROCESSING) {
        await telegramService.sendMessage(chatId, MESSAGES.PROCESSING_IN_PROGRESS);
        return;
      }

      // Check user limits
      const limitCheck = await userLimitsService.checkUserLimit(userId);
      
      if (!limitCheck.canGenerate) {
        if (limitCheck.reason === 'daily_limit_exceeded') {
          await telegramService.sendMessage(chatId, MESSAGES.DAILY_LIMIT_EXCEEDED);
        } else {
          await telegramService.sendMessage(chatId, MESSAGES.SERVICE_ERROR);
        }
        return;
      }

      // Set user state to processing
      this.userStates.set(chatId, BOT_STATES.PROCESSING);

      // Send acknowledgment message
      await telegramService.sendMessage(chatId, MESSAGES.PHOTO_RECEIVED);

      // Log generation start
      await userLimitsService.logGeneration(userId, 'started', {
        firstName,
        photoCount: photos.length
      });

      // Get the highest resolution photo
      const bestPhoto = photos[photos.length - 1]; // Last photo is highest resolution
      
      logger.info(`Starting sticker generation for user ${userId}:`, {
        photoFileId: bestPhoto.file_id,
        photoSize: `${bestPhoto.width}x${bestPhoto.height}`,
        fileSize: bestPhoto.file_size
      });

      // Start actual sticker generation
      this.generateStickerPack(chatId, userId, bestPhoto.file_id, firstName)
        .then((result) => {
          logger.info(`Sticker generation completed for user ${userId}:`, result);
        })
        .catch((error) => {
          logger.error(`Sticker generation failed for user ${userId}:`, error);
        });

    } catch (error) {
      // Reset user state on error
      this.userStates.set(chatId, BOT_STATES.ERROR);
      
      logger.error(`Failed to handle photo message for user ${userId}:`, error);
      
      // Log generation failure
      await userLimitsService.logGeneration(userId, 'failed', {
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Handle text message (non-commands)
   */
  async handleTextMessage(chatId, text) {
    try {
      logger.info(`Handling text message for chat ${chatId}: "${text}"`);
      
      // For now, just tell user to send a photo
      await telegramService.sendMessage(chatId, MESSAGES.SEND_PHOTO_ONLY);
      
    } catch (error) {
      logger.error(`Failed to handle text message for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Handle unsupported message types
   */
  async handleUnsupportedMessage(chatId) {
    try {
      logger.info(`Handling unsupported message for chat ${chatId}`);
      
      await telegramService.sendMessage(chatId, MESSAGES.UNSUPPORTED_MESSAGE);
      
    } catch (error) {
      logger.error(`Failed to handle unsupported message for chat ${chatId}:`, error);
      throw error;
    }
  }

  /**
   * Generate sticker pack for user
   */
  async generateStickerPack(chatId, userId, userPhotoFileId, firstName) {
    const startTime = Date.now();
    let processedStickers = 0;
    let failedStickers = 0;
    let userPhotoBuffer = null;
    let stickerBuffers = [];
    let emojis = [];
    let packName = null;
    
    try {
      logger.info(`Starting sticker pack generation for user ${userId}`);
      
      // Send processing started message
      await telegramService.sendMessage(chatId, MESSAGES.PROCESSING_STARTED);
      
      // Step 1: Download and process user photo
      logger.info(`Processing user photo: ${userPhotoFileId}`);
      userPhotoBuffer = await imageService.processImageForStickers(userPhotoFileId);
      
      // Upload user photo to temporary hosting for Piapi
      // For now, we'll use the downloaded buffer directly
      // In production, you might want to upload to a temporary URL
      
      // Step 2: Get all meme templates
      const templates = getAllTemplates();
      logger.info(`Processing ${templates.length} meme templates`);
      
      // Step 3: Process each template with face swap
      const batchSize = TEMPLATE_CONFIG.BATCH_SIZE;
      const totalBatches = Math.ceil(templates.length / batchSize);
      
      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const batch = templates.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
        
        logger.info(`Processing batch ${batchIndex + 1}/${totalBatches} (${batch.length} templates)`);
        
        const batchPromises = batch.map(async (template, templateIndex) => {
          return this.processTemplate(template, userPhotoBuffer, batchIndex, templateIndex);
        });
        
        const batchResults = await Promise.allSettled(batchPromises);
        
        // Process batch results
        batchResults.forEach((result, index) => {
          const template = batch[index];
          
          if (result.status === 'fulfilled' && result.value) {
            stickerBuffers.push(result.value);
            emojis.push(template.emoji);
            processedStickers++;
            logger.info(`Template ${template.id} processed successfully`);
          } else {
            failedStickers++;
            logger.error(`Template ${template.id} failed:`, result.reason);
            
            if (!TEMPLATE_CONFIG.CONTINUE_ON_TEMPLATE_ERROR) {
              throw new Error(`Template processing failed: ${template.id}`);
            }
          }
        });
        
        // Send progress update
        const progress = Math.round(((batchIndex + 1) / totalBatches) * 100);
        if (progress % 25 === 0 || batchIndex === totalBatches - 1) {
          await telegramService.sendMessage(
            chatId, 
            `🎨 Прогресс обработки: ${progress}% (${processedStickers}/${templates.length} стикеров готово)`
          );
        }
      }
      
      // Step 4: Check if we have enough stickers
      if (processedStickers < TEMPLATE_CONFIG.MIN_SUCCESSFUL_STICKERS) {
        throw new Error(
          `Insufficient stickers generated: ${processedStickers}/${TEMPLATE_CONFIG.MIN_SUCCESSFUL_STICKERS} minimum`
        );
      }
      
      // Step 5: Create sticker pack
      logger.info(`Creating sticker pack with ${stickerBuffers.length} stickers`);
      
      const stickerResult = await stickerService.createCompleteStickerPack(
        userId,
        stickerBuffers,
        emojis,
        `New People Stickers - ${firstName}`
      );
      
      packName = stickerResult.packName;
      const packUrl = stickerResult.packUrl;
      
      // Step 6: Send success message
      const processingTime = Date.now() - startTime;
      
      await telegramService.sendMessage(
        chatId, 
        MESSAGES.STICKERS_READY(packUrl, packName)
      );
      
      // Log generation completion
      await userLimitsService.logGeneration(userId, 'completed', {
        packName,
        packUrl,
        stickerCount: stickerBuffers.length,
        processedTemplates: processedStickers,
        failedTemplates: failedStickers,
        processingTime,
        firstName
      });
      
      // Record generation for daily limits
      await userLimitsService.recordGeneration(userId);
      
      // Reset user state
      this.userStates.set(chatId, BOT_STATES.COMPLETED);
      
      const result = {
        success: true,
        packName,
        packUrl,
        stickerCount: stickerBuffers.length,
        processingTime
      };
      
      logger.info(`Sticker pack generation completed for user ${userId}:`, result);
      
      return result;
      
    } catch (error) {
      // Reset user state on error
      this.userStates.set(chatId, BOT_STATES.ERROR);
      
      const processingTime = Date.now() - startTime;
      
      logger.error(`Sticker pack generation failed for user ${userId}:`, {
        error: error.message,
        processedStickers,
        failedStickers,
        processingTime
      });
      
      // Send error message
      await telegramService.sendMessage(chatId, MESSAGES.PROCESSING_ERROR);
      
      // Log generation failure
      await userLimitsService.logGeneration(userId, 'failed', {
        error: error.message,
        processedStickers,
        failedStickers,
        processingTime
      });
      
      throw error;
    }
  }
  
  /**
   * Process individual template with face swap
   */
  async processTemplate(template, userPhotoBuffer, batchIndex, templateIndex) {
    const templateStartTime = Date.now();
    
    try {
      logger.info(`Processing template ${template.id} (batch ${batchIndex}, index ${templateIndex})`);
      
      // Step 1: Check if Piapi service is configured
      if (!piapiService.isServiceConfigured()) {
        logger.warn(`Piapi not configured, using fallback processing for template ${template.id}`);
        
        // Fallback: Download template and create composite image
        const templateBuffer = await imageService.downloadImageFromUrl(template.imageUrl);
        const optimizedSticker = await imageService.optimizeForStickers(userPhotoBuffer, {
          maxSize: TEMPLATE_CONFIG.OUTPUT_STICKER_SIZE,
          quality: TEMPLATE_CONFIG.OUTPUT_QUALITY
        });
        
        return optimizedSticker;
      }
      
      // Step 2: Upload user photo to temporary hosting for Piapi API
      // For now, we'll need to create temporary URLs for Piapi
      // This is a simplified approach - in production you might use cloud storage
      const userPhotoUrl = await this.uploadTemporaryImage(userPhotoBuffer, `user_${Date.now()}`);
      
      // Step 3: Call Piapi face swap service with URLs
      logger.info(`Calling Piapi face swap for template ${template.id}`);
      const faceSwapResult = await piapiService.processFaceSwap(
        template.imageUrl, // target image (meme template)
        userPhotoUrl,      // source image (user's face)
        {
          taskOptions: {
            quality: TEMPLATE_CONFIG.FACE_SWAP_QUALITY,
            confidence_threshold: TEMPLATE_CONFIG.FACE_DETECTION_CONFIDENCE
          },
          waitOptions: {
            maxWaitTime: TEMPLATE_CONFIG.PROCESSING_TIMEOUT_PER_TEMPLATE,
            pollInterval: 2000
          }
        }
      );
      
      // Step 4: Download the result from Piapi
      if (!faceSwapResult.resultUrl) {
        throw new Error('No result URL from Piapi face swap');
      }
      
      const resultBuffer = await imageService.downloadImageFromUrl(faceSwapResult.resultUrl);
      
      // Step 5: Optimize result for Telegram stickers
      const optimizedSticker = await imageService.optimizeForStickers(resultBuffer, {
        maxSize: TEMPLATE_CONFIG.OUTPUT_STICKER_SIZE,
        quality: TEMPLATE_CONFIG.OUTPUT_QUALITY
      });
      
      const processingTime = Date.now() - templateStartTime;
      
      logger.info(`Template ${template.id} processed successfully:`, {
        processingTime,
        outputSize: optimizedSticker.length,
        piapiTaskId: faceSwapResult.taskId,
        resultUrl: faceSwapResult.resultUrl
      });
      
      return optimizedSticker;
      
    } catch (error) {
      const processingTime = Date.now() - templateStartTime;
      
      logger.error(`Template ${template.id} processing failed:`, {
        error: error.message,
        processingTime,
        templateUrl: template.imageUrl
      });
      
      throw errorHandler.createError(
        `Template processing failed: ${template.id} - ${error.message}`,
        TEMPLATE_ERROR_TYPES.FACE_SWAP_FAILED,
        500
      );
    }
  }

  /**
   * Upload image buffer to temporary hosting (placeholder implementation)
   * In production, this should upload to cloud storage or a temporary hosting service
   */
  async uploadTemporaryImage(imageBuffer, filename) {
    // For now, return a placeholder URL - this needs to be implemented
    // In production, you would upload to:
    // - AWS S3 with temporary public access
    // - Google Cloud Storage
    // - A dedicated temporary image hosting service
    
    logger.warn(`Temporary image upload not implemented - using placeholder for ${filename}`);
    
    // This is a temporary fallback - will cause face swap to fail
    throw new Error('Temporary image upload not implemented. Please configure cloud storage for Piapi integration.');
  }

  /**
   * Get user state
   */
  getUserState(chatId) {
    return this.userStates.get(chatId) || BOT_STATES.IDLE;
  }

  /**
   * Set user state
   */
  setUserState(chatId, state) {
    this.userStates.set(chatId, state);
  }

  /**
   * Setup webhook URL
   * This method will be called on server startup
   */
  async setupWebhook() {
    if (!telegramService.isConfigured()) {
      logger.warn('Webhook setup skipped - TelegramService not configured');
      return;
    }

    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
    
    if (!webhookUrl || webhookUrl === 'https://your-domain.railway.app') {
      logger.warn('Webhook setup skipped - TELEGRAM_WEBHOOK_URL not configured');
      logger.info('Set TELEGRAM_WEBHOOK_URL in production environment');
      return;
    }

    try {
      const fullWebhookUrl = `${webhookUrl}/webhook`;
      logger.info(`Setting up webhook: ${fullWebhookUrl}`);
      
      const success = await telegramService.setWebhook(fullWebhookUrl);
      
      if (success) {
        logger.info('✅ Webhook setup completed successfully');
      } else {
        logger.error('❌ Webhook setup failed');
      }
      
    } catch (error) {
      logger.error('Failed to setup webhook:', error);
    }
  }
}

module.exports = new TelegramController();