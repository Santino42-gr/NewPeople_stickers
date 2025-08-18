/**
 * Simple logger utility for the application
 * Provides structured logging with timestamps and levels
 */

class Logger {
  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  /**
   * Format log message with timestamp and level
   */
  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    
    if (this.isProduction) {
      // JSON structured logging for production
      return JSON.stringify({
        timestamp,
        level: level.toUpperCase(),
        message: typeof message === 'string' ? message : JSON.stringify(message),
        ...metadata
      });
    } else {
      // Human readable logging for development
      const formattedMessage = typeof message === 'string' ? message : JSON.stringify(message);
      const metadataStr = Object.keys(metadata).length > 0 ? ` | ${JSON.stringify(metadata)}` : '';
      return `[${level.toUpperCase()}] ${timestamp} - ${formattedMessage}${metadataStr}`;
    }
  }

  /**
   * Log info level messages
   */
  info(message, metadata = {}) {
    console.log(this.formatMessage('info', message, metadata));
  }

  /**
   * Log warning level messages
   */
  warn(message, metadata = {}) {
    console.warn(this.formatMessage('warn', message, metadata));
  }

  /**
   * Log error level messages
   */
  error(message, metadata = {}) {
    console.error(this.formatMessage('error', message, metadata));
  }

  /**
   * Log debug level messages (only in development)
   */
  debug(message, metadata = {}) {
    if (this.isDevelopment) {
      console.log(this.formatMessage('debug', message, metadata));
    }
  }

  /**
   * Log HTTP request information
   */
  logRequest(req, res, duration) {
    const { method, url, ip } = req;
    const { statusCode } = res;
    const userAgent = req.get('User-Agent') || 'Unknown';
    const contentLength = res.get('Content-Length') || 0;
    
    this.info(`${method} ${url} - ${statusCode} - ${duration}ms`, {
      category: 'http_request',
      method,
      url,
      statusCode,
      duration,
      ip,
      userAgent,
      contentLength,
      success: statusCode < 400
    });
  }

  /**
   * Log user activity (for bot interactions)
   */
  logUserActivity(userId, action, details = {}) {
    this.info(`User ${userId} - ${action}`, {
      category: 'user_activity',
      userId,
      action,
      ...details
    });
  }

  /**
   * Log API calls to external services
   */
  logApiCall(service, endpoint, duration, success = true, metadata = {}) {
    const status = success ? 'SUCCESS' : 'FAILED';
    const level = success ? 'info' : 'error';
    
    this[level](`API Call: ${service} ${endpoint} - ${status} - ${duration}ms`, {
      category: 'api_call',
      service,
      endpoint,
      duration,
      success,
      status,
      ...metadata
    });
  }

  /**
   * Log performance metrics
   */
  logPerformance(operation, duration, metadata = {}) {
    this.info(`Performance: ${operation} - ${duration}ms`, {
      category: 'performance',
      operation,
      duration,
      ...metadata
    });
  }

  /**
   * Log generation process stages
   */
  logGeneration(userId, stage, metadata = {}) {
    this.info(`Generation ${stage} for user ${userId}`, {
      category: 'generation',
      userId,
      stage,
      ...metadata
    });
  }

  /**
   * Log security events
   */
  logSecurity(event, severity = 'warn', metadata = {}) {
    this[severity](`Security: ${event}`, {
      category: 'security',
      event,
      severity,
      ...metadata
    });
  }

  /**
   * Log business metrics
   */
  logMetric(metricName, value, metadata = {}) {
    this.info(`Metric: ${metricName} = ${value}`, {
      category: 'metric',
      metricName,
      value,
      ...metadata
    });
  }

  /**
   * Log system events
   */
  logSystem(event, metadata = {}) {
    this.info(`System: ${event}`, {
      category: 'system',
      event,
      ...metadata
    });
  }
}

// Export singleton instance
module.exports = new Logger();