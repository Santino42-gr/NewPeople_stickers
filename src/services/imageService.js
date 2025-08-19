/**
 * Image Processing Service
 * Handles downloading, validation, and conversion of user photos for sticker creation
 */

const axios = require('axios');
const sharp = require('sharp');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const validators = require('../utils/validators');
const telegramService = require('./telegramService');
const { CONFIG, VALIDATION } = require('../config/constants');

class ImageService {
  constructor() {
    logger.info('ImageService initialized');
  }

  /**
   * Download image from Telegram using file ID
   * @param {string} fileId - Telegram file ID
   * @returns {Promise<Buffer>} - Image buffer
   */
  async downloadImageFromTelegram(fileId) {
    const startTime = Date.now();
    
    try {
      const fileIdValidation = validators.isValidFileId(fileId);
      if (!fileIdValidation.valid) {
        throw errorHandler.createError(fileIdValidation.error, 'ValidationError', 400);
      }

      logger.info(`Downloading image from Telegram: ${fileId}`);

      // Get file URL from Telegram
      const fileUrl = await telegramService.getFile(fileId);
      
      // Download the image with retry logic
      const response = await errorHandler.safeExecuteWithRetries(
        async () => await axios.get(fileUrl, {
          responseType: 'arraybuffer',
          timeout: CONFIG.API_TIMEOUT,
          maxContentLength: CONFIG.MAX_IMAGE_SIZE
        }),
        null,
        3
      );

      const imageBuffer = Buffer.from(response.data);
      const duration = Date.now() - startTime;

      logger.info(`Image downloaded successfully:`, {
        fileId,
        size: imageBuffer.length,
        duration
      });

      return imageBuffer;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to download image ${fileId}:`, error);
      
      throw errorHandler.handleImageProcessingError(error, {
        fileId,
        method: 'downloadImageFromTelegram',
        duration
      });
    }
  }

  /**
   * Validate image buffer and metadata
   * @param {Buffer} imageBuffer - Image data
   * @returns {Promise<Object>} - Validation result with metadata
   */
  async validateImage(imageBuffer) {
    const startTime = Date.now();
    
    try {
      const bufferValidation = validators.isValidImageBuffer(imageBuffer);
      if (!bufferValidation.valid) {
        throw errorHandler.createError(bufferValidation.error, 'ValidationError', 400);
      }

      logger.info(`Validating image buffer (${imageBuffer.length} bytes)`);

      // Get image metadata using Sharp
      const metadata = await sharp(imageBuffer).metadata();
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {
          format: metadata.format,
          width: metadata.width,
          height: metadata.height,
          channels: metadata.channels,
          hasAlpha: metadata.hasAlpha,
          density: metadata.density,
          fileSize: imageBuffer.length
        }
      };

      // Validate format
      if (!CONFIG.SUPPORTED_FORMATS.includes(`image/${metadata.format}`)) {
        validation.errors.push(`Unsupported format: ${metadata.format}. Supported: JPEG, PNG`);
        validation.isValid = false;
      }

      // Validate size
      if (imageBuffer.length > CONFIG.MAX_IMAGE_SIZE) {
        validation.errors.push(`File too large: ${imageBuffer.length} bytes. Max: ${CONFIG.MAX_IMAGE_SIZE}`);
        validation.isValid = false;
      }

      // Validate dimensions
      if (!metadata.width || !metadata.height) {
        validation.errors.push('Invalid image dimensions');
        validation.isValid = false;
      } else {
        // Check minimum dimensions
        if (metadata.width < VALIDATION.MIN_IMAGE_WIDTH || metadata.height < VALIDATION.MIN_IMAGE_HEIGHT) {
          validation.errors.push(`Image too small: ${metadata.width}x${metadata.height}. Min: ${VALIDATION.MIN_IMAGE_WIDTH}x${VALIDATION.MIN_IMAGE_HEIGHT}`);
          validation.isValid = false;
        }

        // Check maximum dimensions  
        if (metadata.width > 4096 || metadata.height > 4096) {
          validation.warnings.push(`Large image: ${metadata.width}x${metadata.height}. Will be resized`);
        }

        // Check aspect ratio extremes
        const aspectRatio = metadata.width / metadata.height;
        if (aspectRatio > VALIDATION.MAX_IMAGE_ASPECT_RATIO || aspectRatio < (1 / VALIDATION.MAX_IMAGE_ASPECT_RATIO)) {
          validation.warnings.push(`Extreme aspect ratio: ${aspectRatio.toFixed(2)}. Recommended: ${(1 / VALIDATION.MAX_IMAGE_ASPECT_RATIO).toFixed(2)} - ${VALIDATION.MAX_IMAGE_ASPECT_RATIO}`);
        }
      }

      const duration = Date.now() - startTime;
      
      logger.info(`Image validation completed:`, {
        isValid: validation.isValid,
        format: metadata.format,
        size: `${metadata.width}x${metadata.height}`,
        fileSize: imageBuffer.length,
        errors: validation.errors.length,
        warnings: validation.warnings.length,
        duration
      });

      return validation;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Image validation failed:', error);
      
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings: [],
        metadata: null
      };
    }
  }

  /**
   * Convert image to WebP format
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {Object} options - Conversion options
   * @returns {Promise<Buffer>} - WebP image buffer
   */
  async convertToWebP(imageBuffer, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!Buffer.isBuffer(imageBuffer)) {
        throw errorHandler.createError('Valid image buffer is required', 'ValidationError', 400);
      }

      const {
        quality = 80,
        effort = 4,
        lossless = false
      } = options;

      logger.info(`Converting image to WebP:`, {
        inputSize: imageBuffer.length,
        quality,
        effort,
        lossless
      });

      let sharpInstance = sharp(imageBuffer);

      // Convert to WebP with options
      const webpBuffer = await sharpInstance
        .webp({
          quality,
          effort,
          lossless
        })
        .toBuffer();

      const duration = Date.now() - startTime;
      const compressionRatio = (1 - webpBuffer.length / imageBuffer.length) * 100;

      logger.info(`WebP conversion completed:`, {
        inputSize: imageBuffer.length,
        outputSize: webpBuffer.length,
        compressionRatio: `${compressionRatio.toFixed(1)}%`,
        duration
      });

      return webpBuffer;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('WebP conversion failed:', error);
      
      throw errorHandler.createError(
        `WebP conversion failed: ${error.message}`,
        'ConversionError',
        500
      );
    }
  }

  /**
   * Optimize image for Telegram stickers
   * @param {Buffer} imageBuffer - Input image buffer
   * @param {Object} options - Optimization options
   * @returns {Promise<Buffer>} - Optimized WebP buffer
   */
  async optimizeForStickers(imageBuffer, options = {}) {
    const startTime = Date.now();
    
    try {
      if (!Buffer.isBuffer(imageBuffer)) {
        throw errorHandler.createError('Valid image buffer is required', 'ValidationError', 400);
      }

      const {
        maxSize = CONFIG.STICKER_MAX_SIZE, // 512px
        quality = 85,
        targetFileSize = CONFIG.MAX_STICKER_FILE_SIZE // 500KB
      } = options;

      logger.info(`Optimizing image for stickers:`, {
        inputSize: imageBuffer.length,
        maxSize,
        quality,
        targetFileSize
      });

      // Get original metadata
      const metadata = await sharp(imageBuffer).metadata();
      
      let sharpInstance = sharp(imageBuffer);
      
      // Calculate optimal dimensions while preserving aspect ratio
      let outputWidth = metadata.width;
      let outputHeight = metadata.height;
      
      if (outputWidth > maxSize || outputHeight > maxSize) {
        if (outputWidth > outputHeight) {
          outputHeight = Math.round((outputHeight * maxSize) / outputWidth);
          outputWidth = maxSize;
        } else {
          outputWidth = Math.round((outputWidth * maxSize) / outputHeight);
          outputHeight = maxSize;
        }
      }

      // Resize if needed
      if (outputWidth !== metadata.width || outputHeight !== metadata.height) {
        sharpInstance = sharpInstance.resize(outputWidth, outputHeight, {
          kernel: sharp.kernel.lanczos3,
          withoutEnlargement: true
        });
      }

      // Start with high quality
      let currentQuality = quality;
      let optimizedBuffer;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        optimizedBuffer = await sharpInstance
          .webp({
            quality: currentQuality,
            effort: 6,
            lossless: false
          })
          .toBuffer();

        // If file size is acceptable, break
        if (optimizedBuffer.length <= targetFileSize || attempts >= maxAttempts) {
          break;
        }

        // Reduce quality for next attempt
        currentQuality = Math.max(50, currentQuality - 10);
        attempts++;
        
        logger.info(`Attempt ${attempts}: size ${optimizedBuffer.length}, quality ${currentQuality}`);
        
      } while (optimizedBuffer.length > targetFileSize && attempts < maxAttempts);

      const duration = Date.now() - startTime;
      const compressionRatio = (1 - optimizedBuffer.length / imageBuffer.length) * 100;

      logger.info(`Sticker optimization completed:`, {
        inputSize: imageBuffer.length,
        outputSize: optimizedBuffer.length,
        dimensions: `${outputWidth}x${outputHeight}`,
        finalQuality: currentQuality,
        compressionRatio: `${compressionRatio.toFixed(1)}%`,
        attempts,
        duration,
        withinTargetSize: optimizedBuffer.length <= targetFileSize
      });

      return optimizedBuffer;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Sticker optimization failed:', error);
      
      throw errorHandler.createError(
        `Sticker optimization failed: ${error.message}`,
        'OptimizationError',
        500
      );
    }
  }

  /**
   * Complete image processing pipeline for stickers
   * @param {string} fileId - Telegram file ID
   * @param {Object} options - Processing options
   * @returns {Promise<Buffer>} - Final optimized WebP buffer
   */
  async processImageForStickers(fileId, options = {}) {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting complete image processing for file: ${fileId}`);

      // Step 1: Download image from Telegram
      const imageBuffer = await this.downloadImageFromTelegram(fileId);

      // Step 2: Validate image
      const validation = await this.validateImage(imageBuffer);
      
      if (!validation.isValid) {
        throw errorHandler.createError(
          `Image validation failed: ${validation.errors.join(', ')}`,
          'ValidationError',
          400
        );
      }

      // Log warnings if any
      if (validation.warnings.length > 0) {
        logger.warn(`Image validation warnings:`, validation.warnings);
      }

      // Step 3: Optimize for stickers
      const optimizedBuffer = await this.optimizeForStickers(imageBuffer, options);

      const duration = Date.now() - startTime;

      logger.info(`Complete image processing finished:`, {
        fileId,
        originalSize: imageBuffer.length,
        finalSize: optimizedBuffer.length,
        compressionRatio: `${((1 - optimizedBuffer.length / imageBuffer.length) * 100).toFixed(1)}%`,
        duration
      });

      return optimizedBuffer;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Complete image processing failed for ${fileId}:`, error);
      
      // Re-throw with context
      if (error.name === 'ValidationError') {
        throw error;
      }
      
      throw errorHandler.createError(
        `Image processing failed: ${error.message}`,
        'ProcessingError',
        500
      );
    }
  }

  /**
   * Get image metadata without full processing
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Promise<Object>} - Image metadata
   */
  async getImageMetadata(imageBuffer) {
    try {
      if (!Buffer.isBuffer(imageBuffer)) {
        throw errorHandler.createError('Valid image buffer is required', 'ValidationError', 400);
      }

      const metadata = await sharp(imageBuffer).metadata();
      
      return {
        format: metadata.format,
        width: metadata.width,
        height: metadata.height,
        channels: metadata.channels,
        hasAlpha: metadata.hasAlpha,
        density: metadata.density,
        fileSize: imageBuffer.length,
        aspectRatio: metadata.width / metadata.height
      };

    } catch (error) {
      logger.error('Failed to get image metadata:', error);
      throw errorHandler.createError(
        `Metadata extraction failed: ${error.message}`,
        'MetadataError',
        500
      );
    }
  }

  /**
   * Check if Sharp library is available
   * @returns {boolean} - Availability status
   */
  isSharpAvailable() {
    try {
      const sharpVersion = sharp.versions;
      logger.info(`Sharp library available:`, sharpVersion);
      return true;
    } catch (error) {
      logger.error('Sharp library not available:', error);
      return false;
    }
  }
}

// Export singleton instance
module.exports = new ImageService();