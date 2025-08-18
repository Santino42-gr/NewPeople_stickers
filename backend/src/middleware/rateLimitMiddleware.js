/**
 * Rate Limiting Middleware
 * Protects against DDoS attacks and implements user-specific rate limits
 */

const logger = require('../utils/logger');
const validators = require('../utils/validators');
const { RATE_LIMITS, PERFORMANCE } = require('../config/constants');

class RateLimitMiddleware {
  constructor() {
    // In-memory storage for rate limiting
    this.ipLimits = new Map();
    this.userLimits = new Map();
    this.globalLimits = new Map();
    
    // Cleanup interval for expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // Clean up every minute
  }

  /**
   * Clean up expired entries from memory
   */
  cleanup() {
    const now = Date.now();
    const expiredTime = 60 * 60 * 1000; // 1 hour

    [this.ipLimits, this.userLimits, this.globalLimits].forEach(map => {
      for (const [key, data] of map.entries()) {
        if (now - data.firstRequest > expiredTime) {
          map.delete(key);
        }
      }
    });

    logger.debug('Rate limit cleanup completed', {
      ipEntries: this.ipLimits.size,
      userEntries: this.userLimits.size,
      globalEntries: this.globalLimits.size
    });
  }

  /**
   * General rate limiting by IP address
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  limitByIP(req, res, next) {
    const ip = this.getClientIP(req);
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxRequests = RATE_LIMITS.TELEGRAM_API_LIMIT || 30;

    if (!this.ipLimits.has(ip)) {
      this.ipLimits.set(ip, {
        count: 1,
        firstRequest: now,
        windowStart: now
      });
      return next();
    }

    const data = this.ipLimits.get(ip);

    // Reset window if it's expired
    if (now - data.windowStart > windowMs) {
      data.count = 1;
      data.windowStart = now;
      this.ipLimits.set(ip, data);
      return next();
    }

    // Check if limit exceeded
    if (data.count >= maxRequests) {
      logger.logSecurity('rate_limit_exceeded', 'warn', {
        ip,
        count: data.count,
        maxRequests,
        windowMs,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });

      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((windowMs - (now - data.windowStart)) / 1000)
      });
    }

    // Increment counter
    data.count++;
    this.ipLimits.set(ip, data);

    // Add rate limit headers
    res.set({
      'X-RateLimit-Limit': maxRequests,
      'X-RateLimit-Remaining': Math.max(0, maxRequests - data.count),
      'X-RateLimit-Reset': new Date(data.windowStart + windowMs).toISOString()
    });

    next();
  }

  /**
   * User-specific rate limiting (for messages per minute)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  limitByUser(req, res, next) {
    // Extract user ID from webhook payload
    const userId = this.extractUserId(req.body);
    
    if (!userId) {
      // If no user ID, skip user-specific limiting
      return next();
    }

    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxMessages = RATE_LIMITS.MESSAGES_PER_MINUTE || 10;

    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, {
        count: 1,
        firstRequest: now,
        windowStart: now
      });
      return next();
    }

    const data = this.userLimits.get(userId);

    // Reset window if it's expired
    if (now - data.windowStart > windowMs) {
      data.count = 1;
      data.windowStart = now;
      this.userLimits.set(userId, data);
      return next();
    }

    // Check if limit exceeded
    if (data.count >= maxMessages) {
      logger.logSecurity('user_rate_limit_exceeded', 'warn', {
        userId,
        count: data.count,
        maxMessages,
        windowMs,
        ip: this.getClientIP(req)
      });

      return res.status(429).json({
        error: 'Too many messages from user',
        retryAfter: Math.ceil((windowMs - (now - data.windowStart)) / 1000)
      });
    }

    // Increment counter
    data.count++;
    this.userLimits.set(userId, data);

    next();
  }

  /**
   * Global rate limiting for resource-intensive operations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  limitGlobalProcessing(req, res, next) {
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 minute window
    const maxConcurrent = RATE_LIMITS.CONCURRENT_PROCESSING || 5;
    
    const key = 'global_processing';

    if (!this.globalLimits.has(key)) {
      this.globalLimits.set(key, {
        count: 1,
        firstRequest: now,
        windowStart: now
      });
      return next();
    }

    const data = this.globalLimits.get(key);

    // Reset window if it's expired
    if (now - data.windowStart > windowMs) {
      data.count = 1;
      data.windowStart = now;
      this.globalLimits.set(key, data);
      return next();
    }

    // Check if limit exceeded
    if (data.count >= maxConcurrent) {
      logger.logSecurity('global_processing_limit_exceeded', 'warn', {
        count: data.count,
        maxConcurrent,
        windowMs,
        ip: this.getClientIP(req),
        queueSize: this.globalLimits.size
      });

      return res.status(503).json({
        error: 'System overloaded, please try again later',
        retryAfter: Math.ceil((windowMs - (now - data.windowStart)) / 1000)
      });
    }

    // Increment counter
    data.count++;
    this.globalLimits.set(key, data);

    next();
  }

  /**
   * Anti-spam protection for specific patterns
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  antiSpam(req, res, next) {
    const payload = req.body;
    const userId = this.extractUserId(payload);
    const ip = this.getClientIP(req);
    
    if (!userId || !payload.message) {
      return next();
    }

    const now = Date.now();
    const spamKey = `spam_${userId}`;
    const spamWindow = 10 * 1000; // 10 seconds
    const maxSameMessage = 3;

    // Check for repeated identical messages
    const messageText = payload.message.text || '';
    const messageKey = `${spamKey}_${this.hashString(messageText)}`;

    if (!this.userLimits.has(messageKey)) {
      this.userLimits.set(messageKey, {
        count: 1,
        firstRequest: now,
        windowStart: now,
        lastMessage: messageText
      });
      return next();
    }

    const data = this.userLimits.get(messageKey);

    // Reset window if it's expired
    if (now - data.windowStart > spamWindow) {
      data.count = 1;
      data.windowStart = now;
      this.userLimits.set(messageKey, data);
      return next();
    }

    // Check for spam (same message repeated)
    if (data.count >= maxSameMessage) {
      logger.logSecurity('spam_detected', 'warn', {
        userId,
        ip,
        messageText: messageText.substring(0, 100),
        count: data.count,
        timeWindow: spamWindow
      });

      return res.status(429).json({
        error: 'Spam detected - please slow down',
        retryAfter: Math.ceil((spamWindow - (now - data.windowStart)) / 1000)
      });
    }

    // Increment counter
    data.count++;
    this.userLimits.set(messageKey, data);

    next();
  }

  /**
   * Adaptive rate limiting based on system load
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Next middleware function
   */
  adaptiveLimit(req, res, next) {
    const memUsage = process.memoryUsage();
    const memUsageMB = memUsage.heapUsed / 1024 / 1024;
    
    // Adjust limits based on memory usage
    let multiplier = 1;
    
    if (memUsageMB > PERFORMANCE.MEMORY_CRITICAL) {
      multiplier = 0.2; // Very strict limits
      logger.logSystem('critical_memory_usage', {
        memUsageMB,
        threshold: PERFORMANCE.MEMORY_CRITICAL,
        multiplier
      });
    } else if (memUsageMB > PERFORMANCE.MEMORY_WARNING) {
      multiplier = 0.5; // Reduced limits
      logger.logSystem('high_memory_usage', {
        memUsageMB,
        threshold: PERFORMANCE.MEMORY_WARNING,
        multiplier
      });
    }

    // Apply multiplier to current request
    req.rateLimitMultiplier = multiplier;
    
    if (multiplier < 1) {
      // Add warning header
      res.set('X-System-Load-Warning', 'High');
      
      // Randomly reject some requests to reduce load
      if (Math.random() > multiplier) {
        logger.logSecurity('adaptive_rate_limit', 'warn', {
          memUsageMB,
          multiplier,
          ip: this.getClientIP(req)
        });
        
        return res.status(503).json({
          error: 'System under high load, please try again',
          retryAfter: 30
        });
      }
    }

    next();
  }

  /**
   * Extract user ID from Telegram webhook payload
   * @param {Object} payload - Webhook payload
   * @returns {number|null} - User ID
   */
  extractUserId(payload) {
    if (!payload) return null;
    
    try {
      return payload.message?.from?.id || 
             payload.callback_query?.from?.id || 
             payload.inline_query?.from?.id || 
             null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get client IP address from request
   * @param {Object} req - Express request object
   * @returns {string} - Client IP
   */
  getClientIP(req) {
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress || 
           req.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }

  /**
   * Simple hash function for strings
   * @param {string} str - String to hash
   * @returns {string} - Hash
   */
  hashString(str) {
    let hash = 0;
    if (!str || str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Create combined rate limiting middleware
   * @returns {Array} - Array of middleware functions
   */
  createRateLimitMiddleware() {
    return [
      this.adaptiveLimit.bind(this),
      this.limitByIP.bind(this),
      this.limitByUser.bind(this),
      this.antiSpam.bind(this)
    ];
  }

  /**
   * Create middleware for processing-heavy endpoints
   * @returns {Array} - Array of middleware functions
   */
  createProcessingLimitMiddleware() {
    return [
      this.adaptiveLimit.bind(this),
      this.limitGlobalProcessing.bind(this),
      this.limitByIP.bind(this),
      this.limitByUser.bind(this)
    ];
  }

  /**
   * Get current rate limit statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      ipLimits: this.ipLimits.size,
      userLimits: this.userLimits.size,
      globalLimits: this.globalLimits.size,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  /**
   * Clear all rate limit data (for testing)
   */
  reset() {
    this.ipLimits.clear();
    this.userLimits.clear();
    this.globalLimits.clear();
    
    logger.info('Rate limit data reset');
  }

  /**
   * Destroy the rate limiter (cleanup)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.reset();
  }
}

// Export singleton instance
module.exports = new RateLimitMiddleware();