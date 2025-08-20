/**
 * Piapi AI Service
 * Handles all interactions with Piapi AI API for face-swap operations
 */

const axios = require('axios');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const validators = require('../utils/validators');

class PiapiService {
  constructor() {
    this.apiKey = process.env.PIAPI_API_KEY;
    this.baseUrl = process.env.PIAPI_BASE_URL || 'https://api.piapi.ai';
    
    if (!this.apiKey || this.apiKey === 'your_piapi_api_key') {
      logger.warn('Piapi API key not configured');
      this.isConfigured = false;
      return;
    }

    // Set up axios defaults
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30 seconds default timeout
    });

    this.isConfigured = true;
    logger.info('PiapiService initialized successfully');
  }

  /**
   * Check if the service is properly configured
   */
  isServiceConfigured() {
    return this.isConfigured;
  }

  /**
   * Create a face-swap task with retry logic
   * @param {string} targetImageUrl - URL of the target image (where face will be placed)
   * @param {string} sourceImageUrl - URL of the source image (face to be swapped)
   * @param {Object} options - Additional options for face swap
   * @returns {Promise<Object>} - Task creation response with task ID
   */
  async createFaceSwapTask(targetImageUrl, sourceImageUrl, options = {}) {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Piapi service not configured', 'ConfigurationError', 500);
    }

    const { maxRetries = 3, retryDelay = 2000, ...taskOptions } = options;
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const startTime = Date.now();
      
      try {
        // Validate input parameters
        if (!targetImageUrl || !sourceImageUrl) {
          throw errorHandler.createError('Target and source image URLs are required', 'ValidationError', 400);
        }

        const targetUrlValidation = validators.isValidUrl(targetImageUrl);
        if (!targetUrlValidation.valid) {
          throw errorHandler.createError(`Invalid target image URL: ${targetUrlValidation.error}`, 'ValidationError', 400);
        }

        const sourceUrlValidation = validators.isValidUrl(sourceImageUrl);
        if (!sourceUrlValidation.valid) {
          throw errorHandler.createError(`Invalid source image URL: ${sourceUrlValidation.error}`, 'ValidationError', 400);
        }

        const taskData = {
          model: 'Qubico/image-toolkit',
          task_type: 'face-swap',
          input: {
            target_image: targetImageUrl,
            swap_image: sourceImageUrl
          },
          ...taskOptions
        };

        logger.info(`Creating face-swap task (attempt ${attempt}/${maxRetries})`, {
          targetImageUrl: targetImageUrl.substring(0, 50) + '...',
          sourceImageUrl: sourceImageUrl.substring(0, 50) + '...',
          options: taskOptions
        });

        const response = await errorHandler.safeExecuteWithRetries(
          async () => await this.client.post('/api/v1/task', taskData),
          null,
          1
        );
        
        const duration = Date.now() - startTime;
        logger.logApiCall('Piapi', 'createTask', duration, true);
        
        // Handle the actual API response format
        const responseData = response.data;
        
        if (responseData.code && responseData.code !== 200) {
          throw new Error(`Piapi API error (${responseData.code}): ${responseData.message || responseData.data?.error?.message || 'Unknown error'}`);
        }
        
        const taskId = responseData.data?.task_id;
        if (!taskId) {
          throw new Error('No task ID returned from Piapi API');
        }

        logger.info(`Face-swap task created successfully: ${taskId}`);
        
        return {
          taskId,
          status: responseData.data?.status || 'pending',
          data: responseData.data
        };

      } catch (error) {
        const duration = Date.now() - startTime;
        logger.logApiCall('Piapi', 'createTask', duration, false);
        
        lastError = error;
        
        // Don't retry for validation errors or auth errors
        if (error.response?.status === 400 || error.response?.status === 401 || error.response?.status === 403) {
          const piapiError = errorHandler.handlePiapiError(error, {
            targetImageUrl,
            sourceImageUrl,
            method: 'createFaceSwapTask',
            attempt
          });
          throw piapiError;
        }
        
        // Log retry attempt
        if (attempt < maxRetries) {
          logger.warn(`Task creation failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms:`, error.message);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }
    
    // All retries exhausted
    logger.error(`Task creation failed after ${maxRetries} attempts`);
    const piapiError = errorHandler.handlePiapiError(lastError, {
      targetImageUrl,
      sourceImageUrl,
      method: 'createFaceSwapTask',
      maxRetriesExceeded: true
    });
    
    throw piapiError;
  }

  /**
   * Get the status of a task
   * @param {string} taskId - Task ID to check
   * @returns {Promise<Object>} - Task status response
   */
  async getTaskStatus(taskId) {
    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Piapi service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();
    
    try {
      if (!taskId) {
        throw errorHandler.createError('Task ID is required', 'ValidationError', 400);
      }

      logger.info(`Checking task status: ${taskId}`);

      const response = await errorHandler.safeExecuteWithRetries(
        async () => await this.client.get(`/api/v1/task/${taskId}`),
        null,
        2
      );
      
      const duration = Date.now() - startTime;
      logger.logApiCall('Piapi', 'getTaskStatus', duration, true);
      
      const responseData = response.data;
      
      if (responseData.code && responseData.code !== 200) {
        throw new Error(`Piapi API error (${responseData.code}): ${responseData.message || responseData.data?.error?.message || 'Unknown error'}`);
      }
      
      const status = responseData.data?.status || 'unknown';
      const progress = responseData.data?.progress || 0;
      
      logger.info(`Task ${taskId} status: ${status} (${progress}%)`);
      
      return {
        taskId,
        status,
        progress,
        result: responseData.data?.output,
        error: responseData.data?.error,
        data: responseData.data
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.logApiCall('Piapi', 'getTaskStatus', duration, false);
      
      const piapiError = errorHandler.handlePiapiError(error, {
        taskId,
        method: 'getTaskStatus'
      });
      
      throw piapiError;
    }
  }

  /**
   * Wait for task completion with polling and retry logic
   * @param {string} taskId - Task ID to wait for
   * @param {Object} options - Polling options
   * @returns {Promise<Object>} - Final task result
   */
  async waitForTaskCompletion(taskId, options = {}) {
    const {
      maxWaitTime = 300000, // 5 minutes default
      pollInterval = 3000,  // 3 seconds default
      maxRetries = 3,       // Max retries for failed status checks
      onProgress = null     // Progress callback
    } = options;

    if (!this.isServiceConfigured()) {
      throw errorHandler.createError('Piapi service not configured', 'ConfigurationError', 500);
    }

    const startTime = Date.now();
    let retryCount = 0;
    
    try {
      logger.info(`Waiting for task completion: ${taskId}`, {
        maxWaitTime,
        pollInterval,
        maxRetries
      });

      while (Date.now() - startTime < maxWaitTime) {
        try {
          const statusResponse = await this.getTaskStatus(taskId);
          
          // Reset retry count on successful status check
          retryCount = 0;
          
          // Call progress callback if provided
          if (onProgress && typeof onProgress === 'function') {
            onProgress(statusResponse);
          }

          // Check if task is completed
          if (statusResponse.status === 'completed' || statusResponse.status === 'success') {
            logger.info(`Task ${taskId} completed successfully`, {
              duration: Date.now() - startTime,
              finalStatus: statusResponse.status
            });
            
            return statusResponse;
          }
          
          // Check if task failed
          if (statusResponse.status === 'failed' || statusResponse.status === 'error') {
            // Extract error message properly from object or string
            let errorMessage = 'Task failed without specific error message';
            let errorDetails = null;
            
            if (statusResponse.error) {
              if (typeof statusResponse.error === 'string') {
                errorMessage = statusResponse.error;
              } else if (typeof statusResponse.error === 'object') {
                errorDetails = statusResponse.error;
                errorMessage = statusResponse.error.message || 
                             statusResponse.error.error || 
                             statusResponse.error.description ||
                             JSON.stringify(statusResponse.error);
              }
            }
            
            logger.error(`Task ${taskId} failed:`, {
              status: statusResponse.status,
              errorMessage,
              errorDetails,
              fullResponse: statusResponse
            });
            
            // Check if this is a face detection error
            const isFaceDetectionError = this.checkIfFaceDetectionError(errorMessage, errorDetails);
            
            const error = errorHandler.createError(
              `Face-swap task failed: ${errorMessage}`, 
              isFaceDetectionError ? 'FaceDetectionError' : 'TaskFailedError', 
              422
            );
            
            // Add additional context
            error.piapiErrorDetails = errorDetails;
            error.piapiErrorMessage = errorMessage;
            error.isFaceDetectionError = isFaceDetectionError;
            
            throw error;
          }
          
          // Wait before next poll
          await new Promise(resolve => setTimeout(resolve, pollInterval));
          
        } catch (statusError) {
          // Handle status check failures with retry logic
          retryCount++;
          logger.warn(`Status check failed for task ${taskId} (attempt ${retryCount}/${maxRetries}):`, statusError.message);
          
          if (retryCount >= maxRetries) {
            logger.error(`Max retries exceeded for task ${taskId}`);
            throw statusError;
          }
          
          // Wait a bit longer before retry
          await new Promise(resolve => setTimeout(resolve, pollInterval * 2));
        }
      }
      
      // Timeout reached
      throw errorHandler.createError(
        `Task timeout: ${taskId} did not complete within ${maxWaitTime}ms`,
        'TaskTimeoutError',
        408
      );

    } catch (error) {
      // If it's already our custom error, re-throw it
      if (error.name === 'TaskFailedError' || error.name === 'TaskTimeoutError') {
        throw error;
      }
      
      // Otherwise, wrap it
      const piapiError = errorHandler.handlePiapiError(error, {
        taskId,
        method: 'waitForTaskCompletion',
        waitTime: Date.now() - startTime,
        retryCount
      });
      
      throw piapiError;
    }
  }

  /**
   * Check if an error is related to face detection
   * @param {string} errorMessage - Error message string
   * @param {Object} errorDetails - Error details object
   * @returns {boolean} - True if this is a face detection error
   */
  checkIfFaceDetectionError(errorMessage, errorDetails) {
    if (!errorMessage && !errorDetails) return false;
    
    // Common face detection error patterns
    const faceDetectionPatterns = [
      'face',
      'detection', 
      'no face',
      'face not found',
      'cannot detect',
      'no faces detected',
      'face detection failed',
      'unable to detect face',
      'no human face',
      'face recognition',
      'низкая уверенность',
      'лицо не найдено',
      'лицо не обнаружено'
    ];
    
    // Check error message
    if (errorMessage) {
      const lowerMessage = errorMessage.toLowerCase();
      if (faceDetectionPatterns.some(pattern => lowerMessage.includes(pattern))) {
        return true;
      }
    }
    
    // Check error details object
    if (errorDetails && typeof errorDetails === 'object') {
      const detailsString = JSON.stringify(errorDetails).toLowerCase();
      if (faceDetectionPatterns.some(pattern => detailsString.includes(pattern))) {
        return true;
      }
      
      // Check specific error codes that might indicate face detection issues
      if (errorDetails.code === 'FACE_NOT_DETECTED' || 
          errorDetails.error_code === 'NO_FACE' ||
          errorDetails.type === 'face_detection_error') {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Helper method to create face-swap and wait for result
   * @param {string} targetImageUrl - URL of the target image
   * @param {string} sourceImageUrl - URL of the source image
   * @param {Object} options - Options for both task creation and waiting
   * @returns {Promise<Object>} - Final result with image URL
   */
  async processFaceSwap(targetImageUrl, sourceImageUrl, options = {}) {
    const { taskOptions = {}, waitOptions = {} } = options;
    
    try {
      logger.info('Starting complete face-swap process');
      
      // Create task
      const createResponse = await this.createFaceSwapTask(
        targetImageUrl, 
        sourceImageUrl, 
        taskOptions
      );
      
      // Wait for completion
      const completionResponse = await this.waitForTaskCompletion(
        createResponse.taskId,
        waitOptions
      );
      
      logger.info('Face-swap process completed successfully', {
        taskId: createResponse.taskId,
        resultUrl: completionResponse.result?.output_url
      });
      
      return {
        taskId: createResponse.taskId,
        status: 'completed',
        resultUrl: completionResponse.result?.image_url || completionResponse.result?.url || completionResponse.result?.output_url,
        result: completionResponse.result
      };
      
    } catch (error) {
      logger.error('Face-swap process failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new PiapiService();