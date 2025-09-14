/**
 * Broadcast Controller
 * Handles HTTP requests for mass messaging campaigns
 */

const broadcastService = require('../services/broadcastService');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const validators = require('../utils/validators');
const multer = require('multer');
const path = require('path');

// Configure multer for image uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

class BroadcastController {
  constructor() {
    // Bind methods to ensure proper 'this' context
    this.createCampaign = this.createCampaign.bind(this);
    this.startCampaign = this.startCampaign.bind(this);
    this.getCampaignStatus = this.getCampaignStatus.bind(this);
    this.listCampaigns = this.listCampaigns.bind(this);
    this.cancelCampaign = this.cancelCampaign.bind(this);
    
    logger.info('BroadcastController initialized');
  }

  /**
   * Get multer upload middleware
   */
  getUploadMiddleware() {
    return upload.single('image');
  }

  /**
   * Create a new broadcast campaign
   */
  async createCampaign(req, res) {
    const startTime = Date.now();
    
    try {
      logger.info('Creating broadcast campaign', {
        body: req.body,
        hasFile: !!req.file,
        ip: req.ip
      });

      // Check if service is configured
      if (!broadcastService.isServiceConfigured()) {
        return res.status(503).json({
          error: 'Broadcast service not configured',
          code: 'SERVICE_UNAVAILABLE'
        });
      }

      const { name, messageText, imageCaption, campaignType } = req.body;
      const imageBuffer = req.file?.buffer;
      const createdBy = req.user?.id || req.headers['x-admin-user'] || 'api';

      // Validation
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        return res.status(400).json({
          error: 'Campaign name is required',
          code: 'INVALID_NAME'
        });
      }

      if (name.length > 255) {
        return res.status(400).json({
          error: 'Campaign name too long (max 255 characters)',
          code: 'NAME_TOO_LONG'
        });
      }

      if (!campaignType || !['text_only', 'image_only', 'text_and_image'].includes(campaignType)) {
        return res.status(400).json({
          error: 'Valid campaign type is required (text_only, image_only, text_and_image)',
          code: 'INVALID_CAMPAIGN_TYPE'
        });
      }

      // Validate message text for text campaigns
      if (campaignType !== 'image_only') {
        if (!messageText || typeof messageText !== 'string' || messageText.trim().length === 0) {
          return res.status(400).json({
            error: 'Message text is required for text campaigns',
            code: 'MISSING_MESSAGE_TEXT'
          });
        }

        if (messageText.length > 4096) {
          return res.status(400).json({
            error: 'Message text too long (max 4096 characters)',
            code: 'MESSAGE_TOO_LONG'
          });
        }
      }

      // Validate image for image campaigns
      if ((campaignType === 'image_only' || campaignType === 'text_and_image')) {
        if (!imageBuffer) {
          return res.status(400).json({
            error: 'Image is required for image campaigns',
            code: 'MISSING_IMAGE'
          });
        }

        if (req.file && req.file.size > 10 * 1024 * 1024) {
          return res.status(400).json({
            error: 'Image file too large (max 10MB)',
            code: 'IMAGE_TOO_LARGE'
          });
        }
      }

      // Validate image caption length
      if (imageCaption && imageCaption.length > 1024) {
        return res.status(400).json({
          error: 'Image caption too long (max 1024 characters)',
          code: 'CAPTION_TOO_LONG'
        });
      }

      // Create campaign
      const campaign = await broadcastService.createCampaign({
        name: name.trim(),
        messageText: messageText?.trim() || null,
        imageBuffer,
        imageCaption: imageCaption?.trim() || null,
        campaignType,
        createdBy
      });

      const duration = Date.now() - startTime;
      
      logger.info(`Campaign created successfully: ${campaign.id}`, {
        name: campaign.name,
        totalRecipients: campaign.totalRecipients,
        campaignType: campaign.campaignType,
        duration,
        createdBy
      });

      res.status(201).json({
        success: true,
        campaign,
        message: 'Campaign created successfully'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to create campaign:', error);

      // Handle specific error types
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }

      if (error.name === 'DatabaseError') {
        return res.status(500).json({
          error: 'Database error occurred',
          code: 'DATABASE_ERROR'
        });
      }

      res.status(500).json({
        error: 'Failed to create campaign',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Start a broadcast campaign
   */
  async startCampaign(req, res) {
    const startTime = Date.now();
    
    try {
      const { campaignId } = req.params;

      logger.info(`Starting campaign: ${campaignId}`, {
        ip: req.ip,
        user: req.user?.id || req.headers['x-admin-user'] || 'api'
      });

      // Check if service is configured
      if (!broadcastService.isServiceConfigured()) {
        return res.status(503).json({
          error: 'Broadcast service not configured',
          code: 'SERVICE_UNAVAILABLE'
        });
      }

      // Validate campaign ID
      if (!campaignId || typeof campaignId !== 'string') {
        return res.status(400).json({
          error: 'Valid campaign ID is required',
          code: 'INVALID_CAMPAIGN_ID'
        });
      }

      // Start campaign
      const success = await broadcastService.startCampaign(campaignId);

      const duration = Date.now() - startTime;
      
      if (success) {
        logger.info(`Campaign started successfully: ${campaignId}`, { duration });

        res.json({
          success: true,
          message: 'Campaign started successfully',
          campaignId
        });
      } else {
        logger.warn(`Failed to start campaign: ${campaignId}`, { duration });

        res.status(500).json({
          error: 'Failed to start campaign',
          code: 'START_FAILED',
          campaignId
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to start campaign ${req.params.campaignId}:`, error);

      // Handle specific error types
      if (error.name === 'NotFoundError') {
        return res.status(404).json({
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        });
      }

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          error: error.message,
          code: 'VALIDATION_ERROR'
        });
      }

      res.status(500).json({
        error: 'Failed to start campaign',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get campaign status and statistics
   */
  async getCampaignStatus(req, res) {
    const startTime = Date.now();
    
    try {
      const { campaignId } = req.params;

      logger.info(`Getting campaign status: ${campaignId}`, {
        ip: req.ip
      });

      // Check if service is configured
      if (!broadcastService.isServiceConfigured()) {
        return res.status(503).json({
          error: 'Broadcast service not configured',
          code: 'SERVICE_UNAVAILABLE'
        });
      }

      // Validate campaign ID
      if (!campaignId || typeof campaignId !== 'string') {
        return res.status(400).json({
          error: 'Valid campaign ID is required',
          code: 'INVALID_CAMPAIGN_ID'
        });
      }

      // Get campaign status
      const campaign = await broadcastService.getCampaignStatus(campaignId);

      const duration = Date.now() - startTime;
      
      logger.info(`Campaign status retrieved: ${campaignId}`, {
        status: campaign.status,
        duration
      });

      res.json({
        success: true,
        campaign
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to get campaign status ${req.params.campaignId}:`, error);

      // Handle specific error types
      if (error.name === 'NotFoundError') {
        return res.status(404).json({
          error: 'Campaign not found',
          code: 'CAMPAIGN_NOT_FOUND'
        });
      }

      res.status(500).json({
        error: 'Failed to get campaign status',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * List all campaigns with optional filtering
   */
  async listCampaigns(req, res) {
    const startTime = Date.now();
    
    try {
      const { status, limit = '50', offset = '0' } = req.query;

      logger.info('Listing campaigns', {
        status,
        limit,
        offset,
        ip: req.ip
      });

      // Check if service is configured
      if (!broadcastService.isServiceConfigured()) {
        return res.status(503).json({
          error: 'Broadcast service not configured',
          code: 'SERVICE_UNAVAILABLE'
        });
      }

      // Validate query parameters
      const limitNum = parseInt(limit);
      const offsetNum = parseInt(offset);

      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        return res.status(400).json({
          error: 'Limit must be between 1 and 100',
          code: 'INVALID_LIMIT'
        });
      }

      if (isNaN(offsetNum) || offsetNum < 0) {
        return res.status(400).json({
          error: 'Offset must be non-negative',
          code: 'INVALID_OFFSET'
        });
      }

      if (status && !['created', 'in_progress', 'completed', 'failed', 'cancelled'].includes(status)) {
        return res.status(400).json({
          error: 'Invalid status filter',
          code: 'INVALID_STATUS_FILTER'
        });
      }

      // Get campaigns
      const campaigns = await broadcastService.listCampaigns({
        status,
        limit: limitNum,
        offset: offsetNum
      });

      const duration = Date.now() - startTime;
      
      logger.info(`Campaigns listed: ${campaigns.length} found`, {
        duration,
        status,
        limit: limitNum,
        offset: offsetNum
      });

      res.json({
        success: true,
        campaigns,
        pagination: {
          limit: limitNum,
          offset: offsetNum,
          count: campaigns.length,
          hasMore: campaigns.length === limitNum
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to list campaigns:', error);

      res.status(500).json({
        error: 'Failed to list campaigns',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Cancel a campaign
   */
  async cancelCampaign(req, res) {
    const startTime = Date.now();
    
    try {
      const { campaignId } = req.params;

      logger.info(`Cancelling campaign: ${campaignId}`, {
        ip: req.ip,
        user: req.user?.id || req.headers['x-admin-user'] || 'api'
      });

      // Check if service is configured
      if (!broadcastService.isServiceConfigured()) {
        return res.status(503).json({
          error: 'Broadcast service not configured',
          code: 'SERVICE_UNAVAILABLE'
        });
      }

      // Validate campaign ID
      if (!campaignId || typeof campaignId !== 'string') {
        return res.status(400).json({
          error: 'Valid campaign ID is required',
          code: 'INVALID_CAMPAIGN_ID'
        });
      }

      // Cancel campaign
      const success = await broadcastService.cancelCampaign(campaignId);

      const duration = Date.now() - startTime;
      
      if (success) {
        logger.info(`Campaign cancelled successfully: ${campaignId}`, { duration });

        res.json({
          success: true,
          message: 'Campaign cancelled successfully',
          campaignId
        });
      } else {
        logger.warn(`Failed to cancel campaign: ${campaignId}`, { duration });

        res.status(500).json({
          error: 'Failed to cancel campaign',
          code: 'CANCEL_FAILED',
          campaignId
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to cancel campaign ${req.params.campaignId}:`, error);

      res.status(500).json({
        error: 'Failed to cancel campaign',
        code: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * Get broadcast system health and statistics
   */
  async getSystemHealth(req, res) {
    try {
      logger.info('Getting broadcast system health', {
        ip: req.ip
      });

      const isConfigured = broadcastService.isServiceConfigured();
      
      if (!isConfigured) {
        return res.status(503).json({
          healthy: false,
          error: 'Broadcast service not configured',
          timestamp: new Date().toISOString()
        });
      }

      // Get recent campaigns as health indicator
      const recentCampaigns = await broadcastService.listCampaigns({ limit: 5 });

      res.json({
        healthy: true,
        configured: isConfigured,
        recentCampaignsCount: recentCampaigns.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to get broadcast system health:', error);

      res.status(500).json({
        healthy: false,
        error: 'Health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export singleton instance
module.exports = new BroadcastController();