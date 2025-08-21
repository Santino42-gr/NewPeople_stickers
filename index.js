/**
 * Main application entry point
 * New People Stickers Bot - Express.js server
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

// Import controllers and utilities
const telegramController = require('./src/controllers/telegramController');
const healthController = require('./src/controllers/healthController');
const statsController = require('./src/controllers/statsController');
const errorHandler = require('./src/utils/errorHandler');
const logger = require('./src/utils/logger');

// Import security middleware
const authMiddleware = require('./src/middleware/authMiddleware');
const rateLimitMiddleware = require('./src/middleware/rateLimitMiddleware');
const validationMiddleware = require('./src/middleware/validationMiddleware');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware for request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.logRequest(req, res, duration);
  });
  
  next();
});

// Security middleware - Simplified for deployment
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP temporarily for deployment
  crossOriginEmbedderPolicy: false
}));

// CORS configuration - Production ready
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        process.env.WEBHOOK_URL ? new URL(process.env.WEBHOOK_URL).origin : null,
        process.env.FRONTEND_URL,
        'https://api.telegram.org'
      ].filter(Boolean);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    } else {
      // Allow all origins in development
      return callback(null, true);
    }
  },
  methods: ['GET', 'POST', 'HEAD', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-API-Key',
    'X-Telegram-Bot-Api-Secret-Token',
    'X-Forwarded-For',
    'X-Real-IP'
  ],
  credentials: true,
  maxAge: 86400 // 24 hours
}));

// Body parsing middleware
app.use(express.json({ 
  limit: '10mb',  // For handling image uploads
  verify: (req, res, buf) => {
    // Store raw body for webhook verification if needed
    req.rawBody = buf;
  }
}));

app.use(express.urlencoded({ 
  extended: true,
  limit: '10mb' 
}));

// Routes with security middleware
app.post('/webhook', 
  ...rateLimitMiddleware.createRateLimitMiddleware(),
  ...authMiddleware.createSecurityMiddleware(),
  ...validationMiddleware.createWebhookValidationMiddleware(),
  errorHandler.asyncHandler(telegramController.handleWebhook.bind(telegramController))
);

app.get('/health', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  errorHandler.asyncHandler(healthController.healthCheck.bind(healthController))
);

app.get('/ready', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  errorHandler.asyncHandler(healthController.readyCheck.bind(healthController))
);

// Enhanced metrics endpoint for monitoring
app.get('/metrics', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  errorHandler.asyncHandler(healthController.metricsCheck.bind(healthController))
);

// Statistics endpoints
app.get('/api/stats', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  errorHandler.asyncHandler(statsController.getStats.bind(statsController))
);

app.get('/api/stats/user/:userId', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  errorHandler.asyncHandler(statsController.getUserStats.bind(statsController))
);

app.get('/api/stats/health', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  errorHandler.asyncHandler(statsController.getStatsHealth.bind(statsController))
);

// Admin/API routes (if needed in the future)
app.get('/admin/stats', 
  ...authMiddleware.createApiSecurityMiddleware(),
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  (req, res) => {
    res.json({
      rateLimitStats: rateLimitMiddleware.getStats(),
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  }
);

// Configuration check endpoint
app.get('/admin/config', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  (req, res) => {
    const piapiService = require('./src/services/piapiService');
    const telegramService = require('./src/services/telegramService');
    
    res.json({
      services: {
        telegram: {
          configured: telegramService.isConfigured(),
          botToken: process.env.TELEGRAM_BOT_TOKEN ? 'SET (' + process.env.TELEGRAM_BOT_TOKEN.substring(0, 10) + '...)' : 'NOT SET',
          webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || 'NOT SET'
        },
        piapi: {
          configured: piapiService.isServiceConfigured(),
          apiKey: process.env.PIAPI_API_KEY ? 'SET (' + process.env.PIAPI_API_KEY.substring(0, 10) + '...)' : 'NOT SET',
          baseUrl: process.env.PIAPI_BASE_URL || 'https://api.piapi.ai/api/v1'
        },
        environment: process.env.NODE_ENV || 'development'
      },
      timestamp: new Date().toISOString()
    });
  }
);

// Test Piapi connection endpoint
app.get('/admin/test-piapi', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  async (req, res) => {
    const piapiService = require('./src/services/piapiService');
    
    try {
      if (!piapiService.isServiceConfigured()) {
        return res.json({
          success: false,
          error: 'Piapi service not configured',
          configured: false
        });
      }

      // Test with official Piapi example URLs from documentation
      const testResult = await piapiService.createFaceSwapTask(
        'https://i.ibb.co/LnLYwhR/66f41e64b1922.jpg', // target image from Piapi docs
        'https://i.ibb.co/m9BFL9J/ad61a39afd9079e57a5908c0bd9dd995.jpg', // source image from Piapi docs
        { maxRetries: 1 }
      );

      res.json({
        success: true,
        configured: true,
        testResult: {
          taskId: testResult.taskId,
          status: testResult.status
        },
        message: 'Piapi API is working correctly'
      });

    } catch (error) {
      // More detailed error logging
      const errorDetails = {
        success: false,
        configured: piapiService.isServiceConfigured(),
        error: error.message,
        errorType: error.name || 'Unknown',
        timestamp: new Date().toISOString()
      };

      // Add more context if it's an HTTP error
      if (error.response) {
        errorDetails.httpStatus = error.response.status;
        errorDetails.httpStatusText = error.response.statusText;
        errorDetails.responseData = error.response.data;
      }

      res.json(errorDetails);
    }
  }
);

// Simple Piapi API key test (without making actual requests)
app.get('/admin/piapi-info', 
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  (req, res) => {
    const apiKey = process.env.PIAPI_API_KEY;
    const baseUrl = process.env.PIAPI_BASE_URL;
    
    res.json({
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey ? apiKey.length : 0,
      apiKeyStart: apiKey ? apiKey.substring(0, 8) + '...' : 'NOT SET',
      baseUrl: baseUrl || 'https://api.piapi.ai/api/v1',
      timestamp: new Date().toISOString()
    });
  }
);

// Test basic Piapi connectivity (just auth check)
app.get('/admin/piapi-auth-test',
  rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware),
  async (req, res) => {
    try {
      const axios = require('axios');
      const apiKey = process.env.PIAPI_API_KEY;
      const baseUrl = process.env.PIAPI_BASE_URL || 'https://api.piapi.ai/api/v1';

      if (!apiKey) {
        return res.json({
          success: false,
          error: 'No API key configured'
        });
      }

      // Try a simple request to test authentication
      const response = await axios.get(`${baseUrl}/account`, {
        headers: {
          'X-Api-Key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      res.json({
        success: true,
        statusCode: response.status,
        data: response.data,
        message: 'API key authentication successful'
      });

    } catch (error) {
      res.json({
        success: false,
        error: error.message,
        statusCode: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        timestamp: new Date().toISOString()
      });
    }
  }
);

// Reset rate limits endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/reset-rate-limits',
    authMiddleware.verifyApiKey.bind(authMiddleware),
    (req, res) => {
      rateLimitMiddleware.reset();
      res.json({ message: 'Rate limits reset' });
    }
  );
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'New People Stickers Bot',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      webhook: '/webhook',
      health: '/health',
      ready: '/ready',
      metrics: '/metrics',
      stats: '/api/stats',
      statsHealth: '/api/stats/health',
      userStats: '/api/stats/user/:userId'
    },
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    method: req.method,
    path: req.originalUrl
  });
});

// Global error handling middleware (must be last)
app.use(errorHandler.handle.bind(errorHandler));

// Graceful shutdown handling
const gracefulShutdown = () => {
  logger.info('Shutting down gracefully...');
  
  // Close rate limiter cleanup intervals
  rateLimitMiddleware.destroy();
  
  // Close server
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Force closing server');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start server
const server = app.listen(PORT, () => {
  logger.info(`🚀 New People Stickers Bot server running on port ${PORT}`);
  logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
  
  // Setup Telegram webhook after server starts
  telegramController.setupWebhook();
});

// Export app for testing
module.exports = { app, server };