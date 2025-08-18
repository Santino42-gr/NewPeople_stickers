/**
 * Health check controller
 * Provides endpoints for monitoring application health
 */

const axios = require('axios');
const { supabase } = require('../config/database');
const logger = require('../utils/logger');
const piapiService = require('../services/piapiService');

class HealthController {
  /**
   * Main health check endpoint
   * Used by Railway and other monitoring services
   */
  async healthCheck(req, res) {
    const startTime = Date.now();
    
    const checks = {
      server: 'ok',
      database: 'unknown',
      telegram: 'unknown',
      piapi: 'unknown',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    };

    try {
      // Check database connection
      checks.database = await this.checkDatabase();
      
      // Check Telegram API (if token is configured)
      checks.telegram = await this.checkTelegramAPI();
      
      // Check Piapi API (if key is configured)  
      checks.piapi = await this.checkPiapiAPI();
      
      // Check memory usage
      checks.memory = this.checkMemoryUsage();
      
      // Check disk space and other system resources
      checks.system = this.checkSystemResources();

      const duration = Date.now() - startTime;
      const isHealthy = this.isSystemHealthy(checks);
      
      logger.info(`Health check completed in ${duration}ms - Status: ${isHealthy ? 'healthy' : 'unhealthy'}`);

      res.status(isHealthy ? 200 : 503).json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        checks,
        responseTime: `${duration}ms`,
        environment: process.env.NODE_ENV || 'unknown',
        version: process.env.npm_package_version || '1.0.0'
      });

    } catch (error) {
      logger.error('Health check failed:', error);
      
      res.status(503).json({
        status: 'unhealthy',
        error: 'Health check failed',
        checks,
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Check database connectivity
   */
  async checkDatabase() {
    try {
      const { data, error } = await supabase
        .from('user_limits')
        .select('count')
        .limit(1);
        
      if (error) {
        logger.warn('Database health check failed:', error.message);
        return 'error';
      }
      
      return 'ok';
    } catch (error) {
      logger.warn('Database health check error:', error.message);
      return 'error';
    }
  }

  /**
   * Check Telegram API connectivity
   */
  async checkTelegramAPI() {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!botToken || botToken === 'your_telegram_bot_token') {
      return 'not_configured';
    }

    try {
      const response = await axios.get(
        `https://api.telegram.org/bot${botToken}/getMe`,
        { timeout: 5000 }
      );
      
      if (response.data && response.data.ok) {
        return 'ok';
      } else {
        return 'error';
      }
    } catch (error) {
      logger.warn('Telegram API health check failed:', error.message);
      return 'error';
    }
  }

  /**
   * Check Piapi API connectivity
   */
  async checkPiapiAPI() {
    if (!piapiService.isServiceConfigured()) {
      return 'not_configured';
    }

    const apiKey = process.env.PIAPI_API_KEY;
    const baseUrl = process.env.PIAPI_BASE_URL || 'https://api.piapi.ai/api/v1';

    try {
      // Try ping endpoint first
      try {
        const response = await axios.get(`${baseUrl}/ping`, {
          headers: { 'X-Api-Key': apiKey },
          timeout: 5000
        });
        return 'ok';
      } catch (pingError) {
        // If ping fails, try a simple task creation (should fail with validation error but prove API access)
        const response = await axios.post(`${baseUrl}/task`, 
          { invalid: 'data' }, 
          {
            headers: { 'X-Api-Key': apiKey },
            timeout: 5000
          }
        );
        return 'ok';
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        // API is accessible, just invalid request - that's OK for health check
        return 'ok';
      } else if (error.response && error.response.status === 401) {
        return 'auth_error';
      } else {
        logger.warn('Piapi API health check failed:', error.message);
        return 'error';
      }
    }
  }

  /**
   * Determine overall system health
   */
  isSystemHealthy(checks) {
    // Critical services that must be OK
    const criticalServices = ['server', 'database'];
    
    // Check if all critical services are OK
    const criticalOk = criticalServices.every(service => checks[service] === 'ok');
    
    // External APIs can be not_configured during development
    const telegramOk = ['ok', 'not_configured'].includes(checks.telegram);
    const piapiOk = ['ok', 'not_configured'].includes(checks.piapi);
    
    return criticalOk && telegramOk && piapiOk;
  }

  /**
   * Check memory usage
   */
  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const totalMB = usage.heapTotal / 1024 / 1024;
    const usedMB = usage.heapUsed / 1024 / 1024;
    const usagePercent = (usedMB / totalMB) * 100;
    
    return {
      status: usagePercent > 90 ? 'critical' : usagePercent > 70 ? 'warning' : 'ok',
      heapUsed: Math.round(usedMB),
      heapTotal: Math.round(totalMB),
      usagePercent: Math.round(usagePercent),
      rss: Math.round(usage.rss / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024)
    };
  }

  /**
   * Check system resources
   */
  checkSystemResources() {
    const cpuUsage = process.cpuUsage();
    const loadAverage = process.loadavg ? process.loadavg() : [0, 0, 0];
    
    return {
      status: 'ok',
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      },
      loadAverage: loadAverage.map(load => Math.round(load * 100) / 100),
      uptime: Math.round(process.uptime()),
      pid: process.pid
    };
  }

  /**
   * Enhanced system health check
   */
  isSystemHealthy(checks) {
    // Critical services that must be OK
    const criticalServices = ['server', 'database'];
    
    // Check if all critical services are OK
    const criticalOk = criticalServices.every(service => checks[service] === 'ok');
    
    // External APIs can be not_configured during development
    const telegramOk = ['ok', 'not_configured'].includes(checks.telegram);
    const piapiOk = ['ok', 'not_configured'].includes(checks.piapi);
    
    // Check memory status
    const memoryOk = ['ok', 'warning'].includes(checks.memory?.status);
    
    return criticalOk && telegramOk && piapiOk && memoryOk;
  }

  /**
   * Simplified ready check for Railway
   * Returns 200 if basic server is running
   */
  async readyCheck(req, res) {
    const memory = process.memoryUsage();
    const memoryUsageMB = Math.round(memory.heapUsed / 1024 / 1024);
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      memory: `${memoryUsageMB}MB`,
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || '1.0.0',
      nodeVersion: process.version
    });
  }

  /**
   * Detailed system metrics for monitoring
   */
  async metricsCheck(req, res) {
    const startTime = Date.now();
    
    try {
      const metrics = {
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        platform: {
          os: process.platform,
          arch: process.arch,
          node: process.version
        },
        environment: process.env.NODE_ENV || 'unknown',
        
        // Health checks
        database: await this.checkDatabase(),
        telegram: await this.checkTelegramAPI(),
        piapi: await this.checkPiapiAPI(),
        
        // Performance
        responseTime: Date.now() - startTime
      };

      res.status(200).json(metrics);
      
    } catch (error) {
      logger.error('Metrics check failed:', error);
      res.status(500).json({
        error: 'Metrics unavailable',
        timestamp: new Date().toISOString()
      });
    }
  }
}

module.exports = new HealthController();