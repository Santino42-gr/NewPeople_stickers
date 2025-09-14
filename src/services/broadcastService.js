/**
 * Broadcast Service
 * Handles mass messaging campaigns for the Telegram bot
 */

const { supabase } = require('../config/database');
const telegramService = require('./telegramService');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const fs = require('fs').promises;
const path = require('path');

class BroadcastService {
  constructor() {
    this.isConfigured = !!supabase && telegramService.isConfigured();
    this.rateLimitDelay = 35; // 35ms delay between messages (≈28 messages/second, safely under 30/sec limit)
    this.maxRetries = 3;
    this.batchSize = 50; // Process recipients in batches
    
    if (this.isConfigured) {
      logger.info('BroadcastService initialized successfully');
    } else {
      logger.warn('BroadcastService initialized without proper configuration');
    }
  }

  /**
   * Check if the service is properly configured
   */
  isServiceConfigured() {
    return this.isConfigured;
  }

  /**
   * Create a new broadcast campaign
   * @param {Object} campaignData - Campaign configuration
   * @returns {Promise<Object>} - Created campaign
   */
  async createCampaign(campaignData) {
    const startTime = Date.now();
    
    try {
      if (!this.isServiceConfigured()) {
        throw errorHandler.createError('Broadcast service not configured', 'ConfigurationError', 500);
      }

      const { name, messageText, imageBuffer, imageUrl: providedImageUrl, imageCaption, campaignType, createdBy } = campaignData;

      // Validate campaign data
      if (!name || typeof name !== 'string') {
        throw errorHandler.createError('Campaign name is required', 'ValidationError', 400);
      }

      if (!campaignType || !['text_only', 'image_only', 'text_and_image'].includes(campaignType)) {
        throw errorHandler.createError('Valid campaign type is required', 'ValidationError', 400);
      }

      if (campaignType !== 'image_only' && (!messageText || typeof messageText !== 'string')) {
        throw errorHandler.createError('Message text is required for text campaigns', 'ValidationError', 400);
      }

      if ((campaignType === 'image_only' || campaignType === 'text_and_image') && !imageBuffer && !providedImageUrl) {
        throw errorHandler.createError('Image is required for image campaigns', 'ValidationError', 400);
      }

      logger.info(`Creating broadcast campaign: ${name}`, {
        campaignType,
        hasText: !!messageText,
        hasImage: !!imageBuffer,
        hasImageUrl: !!providedImageUrl,
        createdBy
      });

      let imageUrl = null;
      
      // Store image if provided as buffer, or use provided URL
      if (imageBuffer) {
        imageUrl = await this.storeImageFile(imageBuffer, name);
      } else if (providedImageUrl) {
        imageUrl = providedImageUrl;
      }

      // Get total number of users for recipients count
      const { data: users, error: usersError } = await supabase
        .from('user_limits')
        .select('user_id')
        .order('user_id');

      if (usersError) {
        logger.error('Failed to get users for campaign:', usersError);
        throw errorHandler.createError('Failed to get users for campaign', 'DatabaseError', 500);
      }

      const totalRecipients = users?.length || 0;

      // Create campaign record
      const { data: campaign, error: campaignError } = await supabase
        .from('broadcast_campaigns')
        .insert([{
          name,
          message_text: messageText || null,
          image_url: imageUrl,
          image_caption: imageCaption || null,
          campaign_type: campaignType,
          total_recipients: totalRecipients,
          created_by: createdBy || 'system'
        }])
        .select()
        .single();

      if (campaignError) {
        logger.error('Failed to create campaign:', campaignError);
        throw errorHandler.createError('Failed to create campaign', 'DatabaseError', 500);
      }

      // Create recipient records
      if (users && users.length > 0) {
        const recipients = users.map(user => ({
          campaign_id: campaign.id,
          user_id: user.user_id,
          status: 'pending'
        }));

        const { error: recipientsError } = await supabase
          .from('broadcast_recipients')
          .insert(recipients);

        if (recipientsError) {
          logger.error('Failed to create recipient records:', recipientsError);
          // Don't throw error - campaign is created, recipients can be added later
        }
      }

      const duration = Date.now() - startTime;
      
      logger.info(`Campaign created successfully: ${campaign.id}`, {
        name: campaign.name,
        totalRecipients,
        campaignType,
        duration
      });

      return {
        id: campaign.id,
        name: campaign.name,
        campaignType: campaign.campaign_type,
        totalRecipients,
        status: campaign.status,
        createdAt: campaign.created_at
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to create campaign:`, error);
      throw error;
    }
  }

  /**
   * Start a broadcast campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<boolean>} - Success status
   */
  async startCampaign(campaignId) {
    try {
      if (!this.isServiceConfigured()) {
        throw errorHandler.createError('Broadcast service not configured', 'ConfigurationError', 500);
      }

      if (!campaignId) {
        throw errorHandler.createError('Campaign ID is required', 'ValidationError', 400);
      }

      logger.info(`Starting broadcast campaign: ${campaignId}`);

      // Get campaign details
      const { data: campaign, error: campaignError } = await supabase
        .from('broadcast_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (campaignError || !campaign) {
        throw errorHandler.createError('Campaign not found', 'NotFoundError', 404);
      }

      if (campaign.status !== 'created') {
        throw errorHandler.createError(`Campaign cannot be started (current status: ${campaign.status})`, 'ValidationError', 400);
      }

      // Update campaign status
      const { error: updateError } = await supabase
        .from('broadcast_campaigns')
        .update({ 
          status: 'in_progress',
          started_at: new Date().toISOString()
        })
        .eq('id', campaignId);

      if (updateError) {
        throw errorHandler.createError('Failed to update campaign status', 'DatabaseError', 500);
      }

      // Start broadcasting in the background
      this.processCampaign(campaignId, campaign).catch(error => {
        logger.error(`Campaign processing failed: ${campaignId}:`, error);
      });

      logger.info(`Campaign started: ${campaignId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to start campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Process campaign - send messages to all recipients
   * @param {string} campaignId - Campaign ID
   * @param {Object} campaign - Campaign data
   * @private
   */
  async processCampaign(campaignId, campaign) {
    const startTime = Date.now();
    let successCount = 0;
    let failureCount = 0;
    let blockedCount = 0;

    try {
      logger.info(`Processing campaign: ${campaignId}`);

      // Get pending recipients
      const { data: recipients, error: recipientsError } = await supabase
        .from('broadcast_recipients')
        .select('id, user_id')
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .order('user_id');

      if (recipientsError) {
        throw new Error(`Failed to get recipients: ${recipientsError.message}`);
      }

      if (!recipients || recipients.length === 0) {
        logger.info(`No recipients found for campaign: ${campaignId}`);
        await this.updateCampaignStatus(campaignId, 'completed', 0, 0, 0);
        return;
      }

      logger.info(`Found ${recipients.length} recipients for campaign: ${campaignId}`);

      // Load image buffer if needed
      let imageBuffer = null;
      if (campaign.image_url && (campaign.campaign_type === 'image_only' || campaign.campaign_type === 'text_and_image')) {
        try {
          // Check if it's a local file path or external URL
          if (campaign.image_url.startsWith('http://') || campaign.image_url.startsWith('https://')) {
            // External URL - download the image
            imageBuffer = await this.downloadImageFromUrl(campaign.image_url);
          } else {
            // Local file path
            imageBuffer = await this.loadImageFile(campaign.image_url);
          }
        } catch (error) {
          logger.error(`Failed to load image for campaign ${campaignId}:`, error);
          // Continue without image for text_and_image campaigns
          if (campaign.campaign_type === 'image_only') {
            throw new Error('Image is required but failed to load');
          }
        }
      }

      // Process recipients in batches
      const batches = this.createBatches(recipients, this.batchSize);
      
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        logger.info(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} recipients)`);

        for (const recipient of batch) {
          try {
            await this.sendMessageToRecipient(recipient, campaign, imageBuffer);
            successCount++;
            
            // Update recipient status
            await this.updateRecipientStatus(recipient.id, 'sent', null);
            
          } catch (error) {
            failureCount++;
            
            const isBlocked = this.isUserBlockedError(error);
            if (isBlocked) {
              blockedCount++;
            }
            
            logger.warn(`Failed to send message to user ${recipient.user_id}:`, {
              error: error.message,
              isBlocked,
              campaignId
            });
            
            // Update recipient status
            await this.updateRecipientStatus(
              recipient.id, 
              isBlocked ? 'blocked' : 'failed', 
              error.message
            );
          }

          // Rate limiting delay
          await this.delay(this.rateLimitDelay);
        }

        // Log progress
        const processed = successCount + failureCount;
        const progress = Math.round((processed / recipients.length) * 100);
        logger.info(`Campaign ${campaignId} progress: ${processed}/${recipients.length} (${progress}%)`);
      }

      // Update campaign status to completed
      await this.updateCampaignStatus(campaignId, 'completed', successCount, failureCount, blockedCount);

      const duration = Date.now() - startTime;
      logger.info(`Campaign completed: ${campaignId}`, {
        totalRecipients: recipients.length,
        successCount,
        failureCount,
        blockedCount,
        duration
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Campaign processing failed: ${campaignId}:`, error);
      
      // Update campaign status to failed
      await this.updateCampaignStatus(campaignId, 'failed', successCount, failureCount, blockedCount);
    }
  }

  /**
   * Send message to a single recipient
   * @param {Object} recipient - Recipient data
   * @param {Object} campaign - Campaign data
   * @param {Buffer} imageBuffer - Image buffer if applicable
   * @private
   */
  async sendMessageToRecipient(recipient, campaign, imageBuffer) {
    const userId = recipient.user_id;
    
    try {
      // Send typing indicator
      await telegramService.sendChatAction(userId, 'typing');
      
      if (campaign.campaign_type === 'text_only') {
        // Send text message only
        await telegramService.sendMessage(userId, campaign.message_text);
        
      } else if (campaign.campaign_type === 'image_only') {
        // Send image only
        if (!imageBuffer) {
          throw new Error('Image buffer not available');
        }
        
        const options = campaign.image_caption ? { caption: campaign.image_caption } : {};
        await telegramService.sendPhoto(userId, imageBuffer, options);
        
      } else if (campaign.campaign_type === 'text_and_image') {
        // Send text message first
        await telegramService.sendMessage(userId, campaign.message_text);
        
        // Wait a bit before sending image
        await this.delay(100);
        
        // Send image with caption if available
        if (imageBuffer) {
          const options = campaign.image_caption ? { caption: campaign.image_caption } : {};
          await telegramService.sendPhoto(userId, imageBuffer, options);
        }
      }
      
    } catch (error) {
      logger.debug(`Message send failed for user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Update recipient status in database
   * @param {string} recipientId - Recipient ID
   * @param {string} status - New status
   * @param {string} errorMessage - Error message if failed
   * @private
   */
  async updateRecipientStatus(recipientId, status, errorMessage = null) {
    try {
      const updateData = {
        status,
        last_attempt_at: new Date().toISOString(),
        delivery_attempt: supabase.raw('delivery_attempt + 1')
      };

      if (status === 'sent') {
        updateData.sent_at = new Date().toISOString();
      }

      if (errorMessage) {
        updateData.error_message = errorMessage.substring(0, 500); // Limit error message length
      }

      await supabase
        .from('broadcast_recipients')
        .update(updateData)
        .eq('id', recipientId);

    } catch (error) {
      logger.warn(`Failed to update recipient status ${recipientId}:`, error.message);
    }
  }

  /**
   * Update campaign status and statistics
   * @param {string} campaignId - Campaign ID
   * @param {string} status - New status
   * @param {number} successCount - Successful deliveries
   * @param {number} failureCount - Failed deliveries
   * @param {number} blockedCount - Blocked users
   * @private
   */
  async updateCampaignStatus(campaignId, status, successCount, failureCount, blockedCount) {
    try {
      const updateData = {
        status,
        successful_deliveries: successCount,
        failed_deliveries: failureCount,
        blocked_users: blockedCount
      };

      if (status === 'completed' || status === 'failed') {
        updateData.completed_at = new Date().toISOString();
      }

      await supabase
        .from('broadcast_campaigns')
        .update(updateData)
        .eq('id', campaignId);

    } catch (error) {
      logger.error(`Failed to update campaign status ${campaignId}:`, error);
    }
  }

  /**
   * Get campaign status and statistics
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<Object>} - Campaign status
   */
  async getCampaignStatus(campaignId) {
    try {
      if (!this.isServiceConfigured()) {
        throw errorHandler.createError('Broadcast service not configured', 'ConfigurationError', 500);
      }

      const { data: campaign, error } = await supabase
        .from('broadcast_campaign_stats')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (error || !campaign) {
        throw errorHandler.createError('Campaign not found', 'NotFoundError', 404);
      }

      return campaign;

    } catch (error) {
      logger.error(`Failed to get campaign status ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * List all campaigns
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Campaign list
   */
  async listCampaigns(options = {}) {
    try {
      if (!this.isServiceConfigured()) {
        throw errorHandler.createError('Broadcast service not configured', 'ConfigurationError', 500);
      }

      const { limit = 50, offset = 0, status } = options;

      let query = supabase
        .from('broadcast_campaign_stats')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (status) {
        query = query.eq('status', status);
      }

      const { data: campaigns, error } = await query;

      if (error) {
        throw errorHandler.createError('Failed to get campaigns', 'DatabaseError', 500);
      }

      return campaigns || [];

    } catch (error) {
      logger.error('Failed to list campaigns:', error);
      throw error;
    }
  }

  /**
   * Cancel a campaign
   * @param {string} campaignId - Campaign ID
   * @returns {Promise<boolean>} - Success status
   */
  async cancelCampaign(campaignId) {
    try {
      if (!this.isServiceConfigured()) {
        throw errorHandler.createError('Broadcast service not configured', 'ConfigurationError', 500);
      }

      const { error } = await supabase
        .from('broadcast_campaigns')
        .update({ 
          status: 'cancelled',
          completed_at: new Date().toISOString()
        })
        .eq('id', campaignId)
        .in('status', ['created', 'in_progress']);

      if (error) {
        throw errorHandler.createError('Failed to cancel campaign', 'DatabaseError', 500);
      }

      logger.info(`Campaign cancelled: ${campaignId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to cancel campaign ${campaignId}:`, error);
      throw error;
    }
  }

  /**
   * Store image file for campaign
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} campaignName - Campaign name for filename
   * @returns {Promise<string>} - File path
   * @private
   */
  async storeImageFile(imageBuffer, campaignName) {
    try {
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(__dirname, '../../uploads/broadcast');
      await fs.mkdir(uploadsDir, { recursive: true });

      // Generate filename
      const timestamp = Date.now();
      const safeName = campaignName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 50);
      const filename = `${safeName}_${timestamp}.png`;
      const filePath = path.join(uploadsDir, filename);

      // Save file
      await fs.writeFile(filePath, imageBuffer);

      logger.info(`Image stored for campaign: ${filePath}`);
      return filePath;

    } catch (error) {
      logger.error('Failed to store image file:', error);
      throw new Error(`Failed to store image: ${error.message}`);
    }
  }

  /**
   * Download image from URL
   * @param {string} imageUrl - Image URL
   * @returns {Promise<Buffer>} - Image buffer
   * @private
   */
  async downloadImageFromUrl(imageUrl) {
    try {
      const https = require('https');
      const http = require('http');
      
      return new Promise((resolve, reject) => {
        const client = imageUrl.startsWith('https:') ? https : http;
        
        const request = client.get(imageUrl, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`Failed to download image: ${response.statusCode}`));
            return;
          }
          
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            logger.info(`Downloaded image from URL: ${imageUrl}`, {
              size: buffer.length,
              contentType: response.headers['content-type']
            });
            resolve(buffer);
          });
        });
        
        request.on('error', (error) => {
          reject(new Error(`Failed to download image: ${error.message}`));
        });
        
        request.setTimeout(30000, () => {
          request.destroy();
          reject(new Error('Image download timeout'));
        });
      });
      
    } catch (error) {
      logger.error('Failed to download image from URL:', error);
      throw new Error(`Image download failed: ${error.message}`);
    }
  }

  /**
   * Load image file for campaign
   * @param {string} imagePath - Image file path
   * @returns {Promise<Buffer>} - Image buffer
   * @private
   */
  async loadImageFile(imagePath) {
    try {
      const imageBuffer = await fs.readFile(imagePath);
      return imageBuffer;
    } catch (error) {
      logger.error(`Failed to load image file: ${imagePath}:`, error);
      throw new Error(`Failed to load image: ${error.message}`);
    }
  }

  /**
   * Check if error indicates user blocked the bot
   * @param {Error} error - Error to check
   * @returns {boolean} - Whether user blocked the bot
   * @private
   */
  isUserBlockedError(error) {
    if (!error) return false;
    
    const errorMessage = error.message?.toLowerCase() || '';
    const errorCode = error.code;
    
    return (
      errorCode === 403 ||
      errorMessage.includes('blocked') ||
      errorMessage.includes('forbidden') ||
      errorMessage.includes('bot was blocked')
    );
  }

  /**
   * Create batches from array
   * @param {Array} array - Array to batch
   * @param {number} batchSize - Size of each batch
   * @returns {Array<Array>} - Array of batches
   * @private
   */
  createBatches(array, batchSize) {
    const batches = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} - Delay promise
   * @private
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export singleton instance
module.exports = new BroadcastService();