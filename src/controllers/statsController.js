/**
 * Statistics Controller
 * Provides bot usage statistics and analytics
 */

const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');
const userLimitsService = require('../services/userLimitsService');

class StatsController {
  /**
   * Get overall bot statistics
   */
  async getStats(req, res) {
    try {
      logger.info('Fetching bot statistics');

      // Check if database is configured
      if (!userLimitsService.isServiceConfigured()) {
        return res.status(503).json({
          error: 'Statistics service not available',
          reason: 'Database not configured',
          stats: {
            totalUsers: 0,
            totalGenerations: 0,
            dailyGenerations: 0,
            successRate: 0
          }
        });
      }

      // Get system statistics from userLimitsService
      const stats = await userLimitsService.getSystemStats();

      logger.info('Bot statistics retrieved:', stats);

      return res.status(200).json({
        success: true,
        data: {
          totalUsers: stats.totalUsers,
          totalGenerations: stats.totalGenerations,
          dailyGenerations: stats.dailyGenerations,
          successRate: stats.successRate,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to fetch bot statistics:', error);
      
      const apiError = errorHandler.createError(
        'Failed to fetch statistics',
        'StatisticsError',
        500
      );

      return res.status(500).json({
        error: apiError.message,
        code: apiError.code
      });
    }
  }

  /**
   * Get detailed user statistics
   */
  async getUserStats(req, res) {
    try {
      const { userId } = req.params;

      if (!userId || isNaN(parseInt(userId))) {
        return res.status(400).json({
          error: 'Valid user ID is required'
        });
      }

      logger.info(`Fetching user statistics for ${userId}`);

      // Check if database is configured
      if (!userLimitsService.isServiceConfigured()) {
        return res.status(503).json({
          error: 'Statistics service not available',
          reason: 'Database not configured'
        });
      }

      // Get user statistics
      const userStats = await userLimitsService.getUserStats(parseInt(userId));

      logger.info(`User statistics retrieved for ${userId}:`, userStats);

      return res.status(200).json({
        success: true,
        data: {
          userId: parseInt(userId),
          ...userStats,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error(`Failed to fetch user statistics for ${req.params.userId}:`, error);
      
      const apiError = errorHandler.createError(
        'Failed to fetch user statistics',
        'UserStatisticsError',
        500
      );

      return res.status(500).json({
        error: apiError.message,
        code: apiError.code
      });
    }
  }

  /**
   * Get health status of statistics service
   */
  async getStatsHealth(req, res) {
    try {
      const isConfigured = userLimitsService.isServiceConfigured();
      
      if (isConfigured) {
        // Try to fetch basic stats to verify database connection
        const stats = await userLimitsService.getSystemStats();
        
        return res.status(200).json({
          success: true,
          status: 'healthy',
          database: 'connected',
          lastCheck: new Date().toISOString(),
          basicStats: {
            totalUsers: stats.totalUsers,
            hasError: !!stats.error
          }
        });
      } else {
        return res.status(503).json({
          success: false,
          status: 'degraded',
          database: 'not_configured',
          lastCheck: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Statistics health check failed:', error);
      
      return res.status(503).json({
        success: false,
        status: 'unhealthy',
        database: 'error',
        error: error.message,
        lastCheck: new Date().toISOString()
      });
    }
  }
}

module.exports = new StatsController();
