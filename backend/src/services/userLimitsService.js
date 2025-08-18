/**
 * User Limits Service
 * Handles user limitations and generation logging for the sticker bot
 */

const { supabase } = require('../config/database');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

class UserLimitsService {
  constructor() {
    this.dailyLimit = 1; // 1 sticker pack per day per user
    this.isConfigured = !!supabase;
    
    if (this.isConfigured) {
      logger.info('UserLimitsService initialized successfully');
    } else {
      logger.warn('UserLimitsService initialized without database connection');
    }
  }

  /**
   * Check if the service is properly configured
   */
  isServiceConfigured() {
    return this.isConfigured;
  }

  /**
   * Check if user can generate a new sticker pack today
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Object>} - Limit check result
   */
  async checkUserLimit(userId) {
    const startTime = Date.now();
    
    try {
      if (!userId || typeof userId !== 'number') {
        throw errorHandler.createError('Valid user ID is required', 'ValidationError', 400);
      }

      logger.info(`Checking user limit for user ${userId}`);

      // If database is not configured, allow all requests (fail-open)
      if (!this.isServiceConfigured()) {
        logger.warn(`Database not configured, allowing request for user ${userId}`);
        return {
          canGenerate: true,
          reason: 'database_not_configured',
          remainingLimit: this.dailyLimit,
          lastGeneration: null
        };
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Query user limits from database
      const { data: userLimit, error } = await supabase
        .from('user_limits')
        .select('*')
        .eq('user_id', userId)
        .single();

      const duration = Date.now() - startTime;

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        logger.error(`Database error checking user limit for ${userId}:`, error);
        
        // Fail-open: allow request if database error
        logger.warn(`Database error, allowing request for user ${userId}`);
        return {
          canGenerate: true,
          reason: 'database_error',
          remainingLimit: this.dailyLimit,
          lastGeneration: null,
          error: error.message
        };
      }

      // User not found in database - first time user
      if (!userLimit || error?.code === 'PGRST116') {
        logger.info(`New user ${userId}, allowing first generation`, { duration });
        return {
          canGenerate: true,
          reason: 'new_user',
          remainingLimit: this.dailyLimit,
          lastGeneration: null
        };
      }

      // Check if last generation was today
      const lastGenerationDate = userLimit.last_generation;
      const canGenerate = lastGenerationDate !== today;

      const result = {
        canGenerate,
        reason: canGenerate ? 'limit_available' : 'daily_limit_exceeded',
        remainingLimit: canGenerate ? this.dailyLimit : 0,
        lastGeneration: lastGenerationDate,
        totalGenerations: userLimit.total_generations || 0
      };

      logger.info(`User limit check completed for ${userId}:`, {
        ...result,
        duration
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to check user limit for ${userId}:`, error);
      
      // Fail-open: allow request if any error occurs
      logger.warn(`Error checking limit, allowing request for user ${userId}`);
      return {
        canGenerate: true,
        reason: 'check_failed',
        remainingLimit: this.dailyLimit,
        lastGeneration: null,
        error: error.message
      };
    }
  }

  /**
   * Record a generation for a user (update or insert user limit)
   * @param {number} userId - Telegram user ID
   * @returns {Promise<boolean>} - Success status
   */
  async recordGeneration(userId) {
    const startTime = Date.now();

    try {
      if (!userId || typeof userId !== 'number') {
        throw errorHandler.createError('Valid user ID is required', 'ValidationError', 400);
      }

      logger.info(`Recording generation for user ${userId}`);

      // If database is not configured, just log and return success (fail-open)
      if (!this.isServiceConfigured()) {
        logger.warn(`Database not configured, skipping record for user ${userId}`);
        return true;
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      const now = new Date().toISOString();

      // Use upsert (insert or update) operation
      const { data, error } = await supabase
        .from('user_limits')
        .upsert({
          user_id: userId,
          last_generation: today,
          total_generations: 1,
          updated_at: now
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
        .select();

      const duration = Date.now() - startTime;

      if (error) {
        logger.error(`Database error recording generation for ${userId}:`, error);
        
        // Don't throw error - fail-open approach
        // The generation can continue even if we can't record the limit
        logger.warn(`Failed to record generation for user ${userId}, continuing anyway`);
        return false;
      }

      logger.info(`Generation recorded successfully for user ${userId}`, {
        duration,
        recordedDate: today
      });

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to record generation for user ${userId}:`, error);
      
      // Don't throw error - fail-open approach
      return false;
    }
  }

  /**
   * Log a generation operation (started, completed, failed)
   * @param {number} userId - Telegram user ID
   * @param {string} status - Operation status (started, completed, failed)
   * @param {Object} details - Additional details
   * @returns {Promise<boolean>} - Success status
   */
  async logGeneration(userId, status, details = {}) {
    const startTime = Date.now();

    try {
      if (!userId || typeof userId !== 'number') {
        throw errorHandler.createError('Valid user ID is required', 'ValidationError', 400);
      }

      if (!status || typeof status !== 'string') {
        throw errorHandler.createError('Valid status is required', 'ValidationError', 400);
      }

      logger.info(`Logging generation for user ${userId}:`, { status, ...details });

      // If database is not configured, just log locally and return success (fail-open)
      if (!this.isServiceConfigured()) {
        logger.warn(`Database not configured, logging locally for user ${userId}:`, {
          status,
          ...details
        });
        return true;
      }

      const logData = {
        user_id: userId,
        status: status,
        error_message: details.error || null,
        processing_time_ms: details.processingTime || null,
        sticker_pack_name: details.packName || null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('generation_logs')
        .insert([logData])
        .select();

      const duration = Date.now() - startTime;

      if (error) {
        logger.error(`Database error logging generation for ${userId}:`, error);
        
        // Don't throw error - fail-open approach
        // Log locally instead
        logger.warn(`Failed to log to database, logging locally for user ${userId}:`, {
          status,
          ...details
        });
        return false;
      }

      logger.info(`Generation logged successfully for user ${userId}`, {
        status,
        duration,
        logId: data?.[0]?.id
      });

      return true;

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error(`Failed to log generation for user ${userId}:`, error);
      
      // Don't throw error - fail-open approach
      // Log locally as fallback
      logger.warn(`Logging fallback for user ${userId}:`, {
        status,
        error: error.message,
        ...details
      });
      
      return false;
    }
  }

  /**
   * Get user generation statistics
   * @param {number} userId - Telegram user ID
   * @returns {Promise<Object>} - User statistics
   */
  async getUserStats(userId) {
    try {
      if (!userId || typeof userId !== 'number') {
        throw errorHandler.createError('Valid user ID is required', 'ValidationError', 400);
      }

      logger.info(`Getting user stats for ${userId}`);

      // If database is not configured, return default stats
      if (!this.isServiceConfigured()) {
        logger.warn(`Database not configured, returning default stats for user ${userId}`);
        return {
          totalGenerations: 0,
          lastGeneration: null,
          canGenerateToday: true,
          successfulGenerations: 0,
          failedGenerations: 0
        };
      }

      // Get user limits
      const { data: userLimit, error: limitsError } = await supabase
        .from('user_limits')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Get generation logs
      const { data: logs, error: logsError } = await supabase
        .from('generation_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (limitsError && limitsError.code !== 'PGRST116') {
        logger.error(`Error getting user stats for ${userId}:`, limitsError);
      }

      if (logsError) {
        logger.error(`Error getting user logs for ${userId}:`, logsError);
      }

      const today = new Date().toISOString().split('T')[0];
      const canGenerateToday = !userLimit || userLimit.last_generation !== today;

      const stats = {
        totalGenerations: userLimit?.total_generations || 0,
        lastGeneration: userLimit?.last_generation || null,
        canGenerateToday,
        successfulGenerations: logs?.filter(log => log.status === 'completed').length || 0,
        failedGenerations: logs?.filter(log => log.status === 'failed').length || 0,
        recentLogs: logs?.slice(0, 5) || []
      };

      logger.info(`User stats retrieved for ${userId}:`, stats);

      return stats;

    } catch (error) {
      logger.error(`Failed to get user stats for ${userId}:`, error);
      
      // Return default stats on error (fail-open)
      return {
        totalGenerations: 0,
        lastGeneration: null,
        canGenerateToday: true,
        successfulGenerations: 0,
        failedGenerations: 0,
        error: error.message
      };
    }
  }

  /**
   * Reset user limit (admin function)
   * @param {number} userId - Telegram user ID
   * @returns {Promise<boolean>} - Success status
   */
  async resetUserLimit(userId) {
    try {
      if (!userId || typeof userId !== 'number') {
        throw errorHandler.createError('Valid user ID is required', 'ValidationError', 400);
      }

      logger.info(`Resetting user limit for ${userId}`);

      if (!this.isServiceConfigured()) {
        logger.warn(`Database not configured, cannot reset limit for user ${userId}`);
        return false;
      }

      const { data, error } = await supabase
        .from('user_limits')
        .delete()
        .eq('user_id', userId);

      if (error) {
        logger.error(`Error resetting user limit for ${userId}:`, error);
        return false;
      }

      logger.info(`User limit reset successfully for ${userId}`);
      return true;

    } catch (error) {
      logger.error(`Failed to reset user limit for ${userId}:`, error);
      return false;
    }
  }

  /**
   * Get system statistics
   * @returns {Promise<Object>} - System statistics
   */
  async getSystemStats() {
    try {
      logger.info('Getting system statistics');

      if (!this.isServiceConfigured()) {
        logger.warn('Database not configured, returning default system stats');
        return {
          totalUsers: 0,
          totalGenerations: 0,
          dailyGenerations: 0,
          successRate: 0,
          error: 'database_not_configured'
        };
      }

      const today = new Date().toISOString().split('T')[0];

      // Get total users and generations
      const { data: limits, error: limitsError } = await supabase
        .from('user_limits')
        .select('*');

      // Get today's generations
      const { data: todayLogs, error: todayError } = await supabase
        .from('generation_logs')
        .select('*')
        .gte('created_at', `${today}T00:00:00.000Z`)
        .lt('created_at', `${today}T23:59:59.999Z`);

      // Get all logs for success rate
      const { data: allLogs, error: allLogsError } = await supabase
        .from('generation_logs')
        .select('status');

      if (limitsError || todayError || allLogsError) {
        logger.error('Error getting system stats:', {
          limitsError,
          todayError,
          allLogsError
        });
      }

      const totalUsers = limits?.length || 0;
      const totalGenerations = limits?.reduce((sum, user) => sum + (user.total_generations || 0), 0) || 0;
      const dailyGenerations = todayLogs?.length || 0;
      
      const completedLogs = allLogs?.filter(log => log.status === 'completed').length || 0;
      const totalLogs = allLogs?.length || 0;
      const successRate = totalLogs > 0 ? (completedLogs / totalLogs) * 100 : 0;

      const stats = {
        totalUsers,
        totalGenerations,
        dailyGenerations,
        successRate: Math.round(successRate * 100) / 100
      };

      logger.info('System statistics:', stats);

      return stats;

    } catch (error) {
      logger.error('Failed to get system stats:', error);
      return {
        totalUsers: 0,
        totalGenerations: 0,
        dailyGenerations: 0,
        successRate: 0,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new UserLimitsService();