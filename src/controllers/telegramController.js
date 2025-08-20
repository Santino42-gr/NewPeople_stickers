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
      
      // Send initial progress message and save message ID for editing
      const progressMessage = await telegramService.sendMessage(
        chatId, 
        MESSAGES.PROCESSING_PROGRESS(0, getAllTemplates().length)
      );
      const progressMessageId = progressMessage.message_id;
      
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
          return this.processTemplate(template, userPhotoBuffer, batchIndex, templateIndex, userId);
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
            const error = result.reason;
            
            // Check if this is a face detection error
            if (error.name === 'FaceDetectionError') {
              logger.error(`Face detection failed on user photo for template ${template.id}`, {
                userId,
                templateId: template.id,
                error: error.message,
                originalError: error.originalError?.message
              });
              
              // Throw face detection error to stop processing
              throw error;
            }
            
            logger.error(`Template ${template.id} failed:`, error);
            
            if (!TEMPLATE_CONFIG.CONTINUE_ON_TEMPLATE_ERROR) {
              throw new Error(`Template processing failed: ${template.id}`);
            }
          }
        });
        
        // Update progress in the same message
        try {
          await telegramService.editMessage(
            chatId,
            progressMessageId,
            MESSAGES.PROCESSING_PROGRESS(processedStickers, templates.length)
          );
        } catch (editError) {
          // If edit fails, log warning but continue
          logger.warn(`Failed to edit progress message: ${editError.message}`);
        }
      }
      
      // Update to final stage: creating pack
      try {
        await telegramService.editMessage(
          chatId,
          progressMessageId,
          MESSAGES.CREATING_PACK
        );
      } catch (editError) {
        logger.warn(`Failed to edit to creating pack message: ${editError.message}`);
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
        `Создать мемстикеры 🩵 @NewPeopleStickers_bot`
      );
      
      packName = stickerResult.packName;
      const packUrl = stickerResult.packUrl;
      const finalStickerCount = stickerResult.stickerCount;
      const uploadedStickers = stickerResult.uploadedStickers;
      
      // Step 6: Send success message
      const processingTime = Date.now() - startTime;
      
      let successMessage = MESSAGES.STICKERS_READY(packUrl, packName);
      
      // Add info about partial success if some stickers failed
      if (finalStickerCount < uploadedStickers) {
        successMessage += `\n\n⚠️ Внимание: добавлено ${finalStickerCount} из ${uploadedStickers} стикеров. Некоторые стикеры могли быть дубликатами.`;
      }
      
      // Create inline keyboard with both pack link and share buttons
      const inlineKeyboard = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '📦 Открыть стикер-пак',
                url: packUrl
              }
            ],
            [
              {
                text: '🚀 Поделиться с друзьями',
                switch_inline_query: `Посмотрите мой персональный стикер-пак! ${packUrl}`
              }
            ]
          ]
        }
      };
      
      await telegramService.sendMessage(chatId, successMessage, inlineKeyboard);
      
      // Log generation completion
      await userLimitsService.logGeneration(userId, 'completed', {
        packName,
        packUrl,
        finalStickerCount,
        uploadedStickers,
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
        finalStickerCount,
        uploadedStickers,
        totalProcessed: stickerBuffers.length,
        processingTime
      };
      
      logger.info(`Sticker pack generation completed for user ${userId}:`, result);
      
      return result;
      
    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      // Handle face detection errors differently
      if (error.name === 'FaceDetectionError') {
        // Reset user state to allow retry
        this.userStates.set(chatId, BOT_STATES.IDLE);
        
        logger.warn(`Face detection failed for user ${userId} - requesting new photo`, {
          error: error.message,
          originalError: error.originalError?.message,
          piapiErrorMessage: error.piapiErrorMessage,
          piapiErrorDetails: error.piapiErrorDetails,
          processingTime,
          firstName,
          userId
        });
        
        // Send face detection error message
        await telegramService.sendMessage(chatId, MESSAGES.FACE_NOT_DETECTED);
        
        // Log face detection failure (but don't count as generation attempt to preserve user's daily limit)
        await userLimitsService.logGeneration(userId, 'face_detection_failed', {
          error: error.message,
          piapiErrorMessage: error.piapiErrorMessage,
          piapiErrorDetails: error.piapiErrorDetails,
          processingTime,
          firstName,
          note: 'User limit not consumed - can retry with better photo'
        });
        
        // Don't throw error - user can try again with new photo
        return {
          success: false,
          reason: 'face_detection_failed',
          message: 'Face not detected, user can retry'
        };
      }
      
      // Handle other errors
      // Reset user state on error
      this.userStates.set(chatId, BOT_STATES.ERROR);
      
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
  async processTemplate(template, userPhotoBuffer, batchIndex, templateIndex, userId) {
    const templateStartTime = Date.now();
    
    try {
      logger.info(`Processing template ${template.id} (batch ${batchIndex}, index ${templateIndex})`);
      
      // Check if this is a ready-made sticker (ID 11 or 12)
      const isReadySticker = template.id === '11' || template.id === '12';
      
      let optimizedSticker;
      let processingMethod = 'fallback';
      
      if (isReadySticker) {
        // For ready stickers, just download and optimize without face swap
        logger.info(`Processing ready-made sticker ${template.id} - no face swap needed`);
        
        const templateBuffer = await imageService.downloadImageFromUrl(template.imageUrl);
        
        optimizedSticker = await imageService.optimizeForStickers(templateBuffer, {
          maxSize: TEMPLATE_CONFIG.OUTPUT_STICKER_SIZE,
          quality: TEMPLATE_CONFIG.OUTPUT_QUALITY
        });
        
        processingMethod = 'ready_sticker';
        logger.info(`Ready sticker ${template.id} processed successfully`);
        
      } else if (piapiService.isServiceConfigured()) {
        try {
          // Step 2: Upload user photo to temporary hosting for Piapi API
          logger.info(`Attempting Piapi face swap for template ${template.id}`);
          const userPhotoUrl = await this.uploadTemporaryImage(userPhotoBuffer, `user_${Date.now()}`);
          
          // Step 3: Call Piapi face swap service with URLs
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
          optimizedSticker = await imageService.optimizeForStickers(resultBuffer, {
            maxSize: TEMPLATE_CONFIG.OUTPUT_STICKER_SIZE,
            quality: TEMPLATE_CONFIG.OUTPUT_QUALITY
          });
          
          processingMethod = 'piapi';
          logger.info(`Template ${template.id} processed with Piapi successfully`);
          
        } catch (piapiError) {
          logger.warn(`Piapi processing failed for template ${template.id}:`, {
            error: piapiError.message,
            templateId: template.id,
            templateUrl: template.imageUrl,
            errorDetails: piapiError.piapiErrorDetails || piapiError.response?.data,
            batchIndex,
            templateIndex,
            errorName: piapiError.name,
            isFaceDetectionError: piapiError.isFaceDetectionError
          });
          
          // Check if it's a face detection error (now properly detected in piapiService)
          const isFaceDetectionError = piapiError.name === 'FaceDetectionError' || 
                                     piapiError.isFaceDetectionError === true;
          
          if (isFaceDetectionError) {
            logger.error(`Face detection failed for template ${template.id}`, {
              userId,
              templateId: template.id,
              isFirstTemplate: batchIndex === 0 && templateIndex === 0,
              error: piapiError.message,
              piapiErrorMessage: piapiError.piapiErrorMessage,
              piapiErrorDetails: piapiError.piapiErrorDetails
            });
            
            // If this is the first template and face detection failed,
            // it means the user's photo has issues and we should stop processing
            if (batchIndex === 0 && templateIndex === 0) {
              const faceDetectionError = new Error('Face detection failed on user photo');
              faceDetectionError.name = 'FaceDetectionError';
              faceDetectionError.originalError = piapiError;
              faceDetectionError.piapiErrorMessage = piapiError.piapiErrorMessage;
              faceDetectionError.piapiErrorDetails = piapiError.piapiErrorDetails;
              throw faceDetectionError;
            }
            
            // For other templates, continue with fallback but log the issue
            logger.warn(`Face detection failed for template ${template.id}, using fallback - continuing with other templates`);
          }
          
          // Fallback processing - use original meme instead of user photo
          optimizedSticker = await this.processFallbackTemplate(template, userPhotoBuffer);
          processingMethod = 'fallback_after_piapi_error';
        }
      } else {
        logger.info(`Piapi not configured, using fallback processing for template ${template.id}`);
        
        // Direct fallback processing
        optimizedSticker = await this.processFallbackTemplate(template, userPhotoBuffer);
      }
      
      const processingTime = Date.now() - templateStartTime;
      
      logger.info(`Template ${template.id} processed successfully:`, {
        processingTime,
        outputSize: optimizedSticker.length,
        method: processingMethod
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
   * Convert image buffer to base64 data URL for Piapi API
   * Piapi supports base64 data URLs which eliminates need for temporary hosting
   */
  async uploadTemporaryImage(imageBuffer, filename) {
    try {
      logger.info(`Converting image to base64 data URL: ${filename}`);
      
      // Convert to base64 data URL - Piapi supports this format
      let contentType = 'image/jpeg'; // default
      
      // Detect content type from buffer or filename
      if (filename.toLowerCase().includes('.png') || imageBuffer[0] === 0x89) {
        contentType = 'image/png';
      } else if (filename.toLowerCase().includes('.webp')) {
        contentType = 'image/webp';  
      } else if (filename.toLowerCase().includes('.jpg') || filename.toLowerCase().includes('.jpeg')) {
        contentType = 'image/jpeg';
      }
      
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${contentType};base64,${base64}`;
      
      logger.info(`Created base64 data URL for image`, {
        contentType,
        originalSize: imageBuffer.length,
        base64Size: base64.length
      });
      
      return dataUrl;
      
    } catch (error) {
      logger.error(`Failed to create base64 data URL: ${error.message}`);
      throw new Error(`Base64 conversion failed: ${error.message}`);
    }
  }

  /**
   * Process template using fallback method (without face swap)
   * Downloads the meme template and creates a composite with user's photo
   */
  async processFallbackTemplate(template, userPhotoBuffer) {
    try {
      logger.info(`Processing template ${template.id} using fallback method`);
      
      // Download meme template from GitHub
      const templateBuffer = await imageService.downloadImageFromUrl(template.imageUrl);
      
      // For fallback, use the original meme template instead of user photo
      // This ensures user gets the meme even if face swap fails
      const optimizedSticker = await imageService.optimizeForStickers(templateBuffer, {
        maxSize: TEMPLATE_CONFIG.OUTPUT_STICKER_SIZE,
        quality: TEMPLATE_CONFIG.OUTPUT_QUALITY
      });
      
      logger.info(`Template ${template.id} processed with fallback method:`, {
        templateSize: templateBuffer.length,
        outputSize: optimizedSticker.length
      });
      
      return optimizedSticker;
      
    } catch (error) {
      logger.error(`Fallback processing failed for template ${template.id}:`, error);
      throw error;
    }
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