# Backend Specification: Node.js Server & API

## 1. Обзор Backend

### Назначение
Backend сервер для обработки Telegram webhook'ов, интеграции с внешними API и управления бизнес-логикой создания стикер-паков.

### Архитектура
- **Язык:** Node.js 18+
- **Фреймворк:** Express.js
- **База данных:** Supabase (PostgreSQL)
- **Хостинг:** Railway
- **Стиль:** Monolithic application

## 2. Технологический стек

### 2.1 Основные зависимости

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "node-telegram-bot-api": "^0.63.0",
    "@supabase/supabase-js": "^2.38.0",
    "axios": "^1.6.0",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
```

### 2.2 Переменные окружения

```env
# Server
PORT=3000
NODE_ENV=production

# Telegram Bot
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_WEBHOOK_URL=https://your-domain.railway.app/webhook

# Piapi API
PIAPI_API_KEY=your_piapi_api_key
PIAPI_BASE_URL=https://api.piapi.ai/api/v1

# Supabase
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# App Configuration
MAX_PROCESSING_TIME=30000
STATUS_CHECK_INTERVAL=3000
```

## 3. Архитектура сервера

### 3.1 Структура проекта

```
backend/
├── index.js                 # Главный файл приложения
├── src/
│   ├── controllers/
│   │   ├── telegramController.js    # Обработка Telegram webhook
│   │   └── healthController.js      # Health check endpoint
│   ├── services/
│   │   ├── telegramService.js       # Telegram Bot API
│   │   ├── piapiService.js          # Piapi API integration
│   │   ├── stickerService.js        # Создание стикер-паков
│   │   └── userLimitsService.js     # Управление лимитами
│   ├── config/
│   │   ├── database.js              # Supabase конфигурация
│   │   ├── constants.js             # Константы приложения
│   │   └── templates.js             # Мем шаблоны
│   ├── utils/
│   │   ├── logger.js                # Логирование
│   │   ├── validators.js            # Валидация данных
│   │   └── errorHandler.js          # Обработка ошибок
│   └── middleware/
│       ├── authMiddleware.js        # Проверка Telegram webhook
│       └── rateLimitMiddleware.js   # Rate limiting
├── package.json
├── .env.example
├── .gitignore
└── railway.toml
```

### 3.2 Главный файл приложения

```javascript
// index.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const telegramController = require('./src/controllers/telegramController');
const healthController = require('./src/controllers/healthController');
const errorHandler = require('./src/utils/errorHandler');
const logger = require('./src/utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.post('/webhook', telegramController.handleWebhook);
app.get('/health', healthController.healthCheck);

// Error handling
app.use(errorHandler.handle);

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  // Setup telegram webhook on startup
  telegramController.setupWebhook();
});
```

## 4. API Интеграции

### 4.1 Telegram Bot API

#### Сервис для работы с Telegram

```javascript
// src/services/telegramService.js
const TelegramBot = require('node-telegram-bot-api');
const logger = require('../utils/logger');

class TelegramService {
  constructor() {
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN);
  }

  async sendMessage(chatId, text, options = {}) {
    try {
      return await this.bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        disable_web_page_preview: true,
        ...options
      });
    } catch (error) {
      logger.error('Telegram sendMessage error:', error);
      throw error;
    }
  }

  async getFile(fileId) {
    try {
      const file = await this.bot.getFile(fileId);
      return `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    } catch (error) {
      logger.error('Telegram getFile error:', error);
      throw error;
    }
  }

  async setWebhook(url) {
    try {
      await this.bot.setWebHook(url);
      logger.info(`Webhook set to: ${url}`);
    } catch (error) {
      logger.error('Webhook setup error:', error);
      throw error;
    }
  }
}

module.exports = new TelegramService();
```

#### Создание стикер-паков

```javascript
// src/services/stickerService.js
const axios = require('axios');
const logger = require('../utils/logger');

class StickerService {
  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN;
    this.baseUrl = `https://api.telegram.org/bot${this.botToken}`;
  }

  generatePackName(userId) {
    const timestamp = Date.now();
    return `np${userId}_${timestamp}_by_NewPeopleStickers_bot`;
  }

  async uploadStickerFile(userId, imageBuffer) {
    try {
      const formData = new FormData();
      formData.append('user_id', userId);
      formData.append('sticker_format', 'static');
      formData.append('sticker', new Blob([imageBuffer]), 'sticker.webp');

      const response = await axios.post(`${this.baseUrl}/uploadStickerFile`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return response.data.result.file_id;
    } catch (error) {
      logger.error('Upload sticker file error:', error);
      throw error;
    }
  }

  async createNewStickerSet(userId, packName, firstStickerFileId, emoji = '😄') {
    try {
      const response = await axios.post(`${this.baseUrl}/createNewStickerSet`, {
        user_id: userId,
        name: packName,
        title: 'Face Memes Pack',
        stickers: [{
          sticker: firstStickerFileId,
          emoji_list: [emoji],
          format: 'static'
        }],
        sticker_type: 'regular'
      });

      return response.data.result;
    } catch (error) {
      logger.error('Create sticker set error:', error);
      throw error;
    }
  }

  async addStickerToSet(userId, packName, stickerFileId, emoji = '😎') {
    try {
      const response = await axios.post(`${this.baseUrl}/addStickerToSet`, {
        user_id: userId,
        name: packName,
        sticker: {
          sticker: stickerFileId,
          emoji_list: [emoji],
          format: 'static'
        }
      });

      return response.data.result;
    } catch (error) {
      logger.error('Add sticker to set error:', error);
      throw error;
    }
  }
}

module.exports = new StickerService();
```

### 4.2 Piapi API Integration

```javascript
// src/services/piapiService.js
const axios = require('axios');
const logger = require('../utils/logger');

class PiapiService {
  constructor() {
    this.apiKey = process.env.PIAPI_API_KEY;
    this.baseUrl = process.env.PIAPI_BASE_URL || 'https://api.piapi.ai/api/v1';
    this.headers = {
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  async createFaceSwapTask(targetImageUrl, swapImageUrl) {
    try {
      const response = await axios.post(`${this.baseUrl}/task`, {
        task_type: 'face-swap',
        model: 'Qubico/image-toolkit',
        input: {
          target_image: targetImageUrl,
          swap_image: swapImageUrl
        }
      }, { headers: this.headers });

      logger.info(`Piapi task created: ${response.data.data.task_id}`);
      return response.data.data.task_id;
    } catch (error) {
      logger.error('Piapi create task error:', error);
      throw error;
    }
  }

  async getTaskStatus(taskId) {
    try {
      const response = await axios.get(`${this.baseUrl}/task/${taskId}`, {
        headers: this.headers
      });

      return response.data.data;
    } catch (error) {
      logger.error(`Piapi get task status error for ${taskId}:`, error);
      throw error;
    }
  }

  async waitForTaskCompletion(taskId, maxWaitTime = 30000) {
    const startTime = Date.now();
    const checkInterval = 3000; // 3 seconds

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const taskData = await this.getTaskStatus(taskId);
        
        if (taskData.status === 'completed') {
          logger.info(`Task ${taskId} completed successfully`);
          return taskData.output.image_url;
        }
        
        if (taskData.status === 'failed') {
          throw new Error(`Task ${taskId} failed`);
        }

        // Wait before next check
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      } catch (error) {
        logger.error(`Error checking task ${taskId}:`, error);
        throw error;
      }
    }

    throw new Error(`Task ${taskId} timeout after ${maxWaitTime}ms`);
  }
}

module.exports = new PiapiService();
```

## 5. База данных

### 5.1 Supabase конфигурация

```javascript
// src/config/database.js
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase configuration');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
```

### 5.2 Схема базы данных

```sql
-- Таблица для отслеживания лимитов пользователей
CREATE TABLE user_limits (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  last_generation DATE NOT NULL DEFAULT CURRENT_DATE,
  total_generations INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для быстрого поиска по user_id
CREATE INDEX idx_user_limits_user_id ON user_limits(user_id);

-- Таблица для логирования операций (опционально)
CREATE TABLE generation_logs (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
  error_message TEXT,
  processing_time_ms INTEGER,
  sticker_pack_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5.3 Сервис управления лимитами

```javascript
// src/services/userLimitsService.js
const supabase = require('../config/database');
const logger = require('../utils/logger');

class UserLimitsService {
  async checkUserLimit(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('user_limits')
        .select('*')
        .eq('user_id', userId)
        .eq('last_generation', today);

      if (error) {
        logger.error('Supabase check limit error:', error);
        // Fail-open: разрешаем создание при ошибке БД
        return true;
      }

      return data.length === 0; // true если лимит не исчерпан
    } catch (error) {
      logger.error('Check user limit error:', error);
      return true; // Fail-open
    }
  }

  async recordGeneration(userId) {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { error } = await supabase
        .from('user_limits')
        .upsert({
          user_id: userId,
          last_generation: today,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        logger.error('Supabase record generation error:', error);
      }
    } catch (error) {
      logger.error('Record generation error:', error);
    }
  }

  async logGeneration(userId, status, details = {}) {
    try {
      const { error } = await supabase
        .from('generation_logs')
        .insert({
          user_id: userId,
          status: status,
          error_message: details.error,
          processing_time_ms: details.processingTime,
          sticker_pack_name: details.packName
        });

      if (error) {
        logger.error('Supabase log generation error:', error);
      }
    } catch (error) {
      logger.error('Log generation error:', error);
    }
  }
}

module.exports = new UserLimitsService();
```

## 6. Основная бизнес-логика

### 6.1 Контроллер Telegram

```javascript
// src/controllers/telegramController.js
const telegramService = require('../services/telegramService');
const piapiService = require('../services/piapiService');
const stickerService = require('../services/stickerService');
const userLimitsService = require('../services/userLimitsService');
const { MESSAGES } = require('../config/constants');
const { MEME_TEMPLATES } = require('../config/templates');
const logger = require('../utils/logger');

class TelegramController {
  async handleWebhook(req, res) {
    try {
      const update = req.body;
      
      if (update.message) {
        await this.processMessage(update.message);
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async processMessage(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;

    try {
      // Handle commands
      if (message.text === '/start') {
        await this.handleStartCommand(chatId);
        return;
      }

      // Handle photo
      if (message.photo) {
        await this.handlePhotoMessage(chatId, userId, message.photo);
        return;
      }

      // Handle other messages
      if (message.text) {
        await telegramService.sendMessage(chatId, MESSAGES.ERROR_NO_PHOTO);
        return;
      }

    } catch (error) {
      logger.error(`Error processing message from user ${userId}:`, error);
      await telegramService.sendMessage(chatId, MESSAGES.ERROR_GENERAL);
    }
  }

  async handleStartCommand(chatId) {
    await telegramService.sendMessage(chatId, MESSAGES.WELCOME);
  }

  async handlePhotoMessage(chatId, userId, photos) {
    // Check user limits
    const canGenerate = await userLimitsService.checkUserLimit(userId);
    if (!canGenerate) {
      await telegramService.sendMessage(chatId, MESSAGES.ERROR_LIMIT);
      return;
    }

    // Send processing message
    await telegramService.sendMessage(chatId, MESSAGES.PROCESSING);

    try {
      // Get user photo URL
      const largestPhoto = photos[photos.length - 1];
      const userPhotoUrl = await telegramService.getFile(largestPhoto.file_id);

      // Record generation start
      await userLimitsService.recordGeneration(userId);
      await userLimitsService.logGeneration(userId, 'started');

      // Generate sticker pack
      const stickerPackUrl = await this.generateStickerPack(userId, userPhotoUrl);

      // Send success message
      await telegramService.sendMessage(chatId, MESSAGES.SUCCESS(stickerPackUrl));
      
      // Log success
      await userLimitsService.logGeneration(userId, 'completed', {
        packName: stickerPackUrl.split('/').pop()
      });

    } catch (error) {
      logger.error(`Sticker generation failed for user ${userId}:`, error);
      await telegramService.sendMessage(chatId, MESSAGES.ERROR_GENERATION);
      
      // Log failure
      await userLimitsService.logGeneration(userId, 'failed', {
        error: error.message
      });
    }
  }

  async generateStickerPack(userId, userPhotoUrl) {
    const startTime = Date.now();
    const packName = stickerService.generatePackName(userId);
    const generatedStickers = [];

    try {
      // Process all meme templates
      for (let i = 0; i < MEME_TEMPLATES.length; i++) {
        const template = MEME_TEMPLATES[i];
        logger.info(`Processing template ${i + 1}/${MEME_TEMPLATES.length} for user ${userId}`);

        // Create face swap task
        const taskId = await piapiService.createFaceSwapTask(template.url, userPhotoUrl);
        
        // Wait for completion
        const resultImageUrl = await piapiService.waitForTaskCompletion(taskId);
        
        // Download and convert to WebP buffer
        const imageBuffer = await this.downloadAndConvertImage(resultImageUrl);
        
        // Upload sticker to Telegram
        const stickerFileId = await stickerService.uploadStickerFile(userId, imageBuffer);
        
        generatedStickers.push({
          fileId: stickerFileId,
          emoji: template.emoji
        });
      }

      // Create sticker pack
      if (generatedStickers.length === 0) {
        throw new Error('No stickers generated');
      }

      // Create pack with first sticker
      await stickerService.createNewStickerSet(
        userId,
        packName,
        generatedStickers[0].fileId,
        generatedStickers[0].emoji
      );

      // Add remaining stickers
      for (let i = 1; i < generatedStickers.length; i++) {
        await stickerService.addStickerToSet(
          userId,
          packName,
          generatedStickers[i].fileId,
          generatedStickers[i].emoji
        );
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Sticker pack created for user ${userId} in ${processingTime}ms`);

      return `https://t.me/addstickers/${packName}`;

    } catch (error) {
      logger.error(`Generate sticker pack error for user ${userId}:`, error);
      throw error;
    }
  }

  async downloadAndConvertImage(imageUrl) {
    // Implementation for downloading image and converting to WebP
    // This is a simplified version - actual implementation would use sharp or similar
    const axios = require('axios');
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data);
  }

  async setupWebhook() {
    const webhookUrl = `${process.env.TELEGRAM_WEBHOOK_URL}/webhook`;
    await telegramService.setWebhook(webhookUrl);
  }
}

module.exports = new TelegramController();
```

## 7. Конфигурация и константы

### 7.1 Сообщения

```javascript
// src/config/constants.js
const MESSAGES = {
  WELCOME: `<b>Чтобы получить ваш уникальный стикерпак</b> — загрузите своё фото.

<b>Советы:</b>
— на фото должно быть хорошо видно ваше лицо;
— на фото не должно быть других лиц, кроме вашего;
— желательно без головного убора и очков;
— если носите очки — попробуйте фото без них;
— не отправляйте фото животных: бот распознаёт только лица людей.`,

  PROCESSING: 'Ваше фото загружено, приступаю к генерации... займет около 5 минут ⏰',
  
  SUCCESS: (url) => `🎉 Ваш стикерпак готов!

👉 Добавить: ${url}

Создано 10 уникальных стикеров с вашим лицом!
Поделитесь с друзьями 🚀`,

  ERROR_GENERATION: '❌ Произошла ошибка при генерации стикеров.\nПопробуйте повторить через 1-2 часа.',
  ERROR_LIMIT: '❌ Вы уже создавали стикерпак сегодня.\nСледующий пак можно создать завтра.',
  ERROR_NO_PHOTO: '❌ Пожалуйста, отправьте фотографию, а не текстовое сообщение.',
  ERROR_GENERAL: '❌ Произошла техническая ошибка.\nПопробуйте позже или обратитесь в поддержку.'
};

const CONFIG = {
  MAX_PROCESSING_TIME: parseInt(process.env.MAX_PROCESSING_TIME) || 30000,
  STATUS_CHECK_INTERVAL: parseInt(process.env.STATUS_CHECK_INTERVAL) || 3000,
  MAX_RETRIES: 3,
  STICKER_PACK_TITLE: 'Face Memes Pack'
};

module.exports = { MESSAGES, CONFIG };
```

### 7.2 Шаблоны мемов

```javascript
// src/config/templates.js
const MEME_TEMPLATES = [
  {
    id: "t1",
    url: "https://drive.google.com/uc?export=download&id=1M7z1maLqUIssTU0FuxVQuAbcRy45iFMg",
    emoji: "😄"
  },
  {
    id: "t2",
    url: "https://drive.google.com/uc?export=download&id=1Eh0nMYxI_cFymSiJ-KywkH-l9cFliL5o",
    emoji: "😎"
  },
  {
    id: "t3",
    url: "https://drive.google.com/uc?export=download&id=1mFOnGcyv8aM-Ku6y9YQT83J-V32_xdkv",
    emoji: "🤪"
  },
  {
    id: "t4",
    url: "https://drive.google.com/uc?export=download&id=1yuQH7L8G5L6lGiiFPqMqGy7wQxH1m0EI",
    emoji: "😏"
  },
  {
    id: "t5",
    url: "https://drive.google.com/uc?export=download&id=1c84RrrMYqVnPaRS20OSWtdQ_L_R93aOk",
    emoji: "🥳"
  },
  {
    id: "t6",
    url: "https://drive.google.com/uc?export=download&id=1BdqSYtH95IJ_5e8dIy2jM6QYLsZpWQsE",
    emoji: "🤯"
  },
  {
    id: "t7",
    url: "https://drive.google.com/uc?export=download&id=17usAMNogXrIo_TqkkKuX4J58ktvjBHcA",
    emoji: "😂"
  },
  {
    id: "t8",
    url: "https://drive.google.com/uc?export=download&id=11gRb8BEEOansTYWKP4VdqCkCC1HrRSWR",
    emoji: "🔥"
  },
  {
    id: "t9",
    url: "https://drive.google.com/uc?export=download&id=172rLv9lG8GUB56UVtHHNn3FA3MZZRt3Y",
    emoji: "💪"
  },
  {
    id: "t10",
    url: "https://drive.google.com/uc?export=download&id=1krXoNBuoxe7HHzmMODw04xk7ScokjFm3",
    emoji: "🚀"
  }
];

module.exports = { MEME_TEMPLATES };
```

## 8. Утилиты и middleware

### 8.1 Логирование

```javascript
// src/utils/logger.js
class Logger {
  info(message, ...args) {
    console.log(`[INFO] ${new Date().toISOString()} - ${message}`, ...args);
  }

  error(message, ...args) {
    console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, ...args);
  }

  warn(message, ...args) {
    console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, ...args);
  }

  debug(message, ...args) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${new Date().toISOString()} - ${message}`, ...args);
    }
  }
}

module.exports = new Logger();
```

### 8.2 Обработка ошибок

```javascript
// src/utils/errorHandler.js
const logger = require('./logger');

class ErrorHandler {
  handle(error, req, res, next) {
    logger.error('Unhandled error:', error);

    const isDev = process.env.NODE_ENV === 'development';
    
    res.status(500).json({
      error: 'Internal server error',
      ...(isDev && { details: error.message, stack: error.stack })
    });
  }

  async safeExecute(asyncFn, fallbackValue = null) {
    try {
      return await asyncFn();
    } catch (error) {
      logger.error('Safe execute error:', error);
      return fallbackValue;
    }
  }
}

module.exports = new ErrorHandler();
```

### 8.3 Валидация

```javascript
// src/utils/validators.js
class Validators {
  isValidUserId(userId) {
    return Number.isInteger(userId) && userId > 0;
  }

  isValidChatId(chatId) {
    return Number.isInteger(chatId);
  }

  isValidPhotoArray(photos) {
    return Array.isArray(photos) && photos.length > 0 && photos[0].file_id;
  }

  isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  sanitizeText(text) {
    if (typeof text !== 'string') return '';
    return text.replace(/[<>&"']/g, (char) => {
      const map = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#39;'
      };
      return map[char];
    });
  }
}

module.exports = new Validators();
```

## 9. Health Check и мониторинг

### 9.1 Health Check endpoint

```javascript
// src/controllers/healthController.js
const supabase = require('../config/database');
const axios = require('axios');

class HealthController {
  async healthCheck(req, res) {
    const checks = {
      server: 'ok',
      database: 'unknown',
      piapi: 'unknown',
      telegram: 'unknown'
    };

    // Check database
    try {
      const { data, error } = await supabase.from('user_limits').select('count').limit(1);
      checks.database = error ? 'error' : 'ok';
    } catch {
      checks.database = 'error';
    }

    // Check Piapi API
    try {
      const response = await axios.get(`${process.env.PIAPI_BASE_URL}/ping`, {
        headers: { 'X-Api-Key': process.env.PIAPI_API_KEY },
        timeout: 5000
      });
      checks.piapi = response.status === 200 ? 'ok' : 'error';
    } catch {
      checks.piapi = 'error';
    }

    // Check Telegram API
    try {
      const response = await axios.get(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, {
        timeout: 5000
      });
      checks.telegram = response.status === 200 ? 'ok' : 'error';
    } catch {
      checks.telegram = 'error';
    }

    const isHealthy = Object.values(checks).every(status => status === 'ok' || status === 'unknown');
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      checks
    });
  }
}

module.exports = new HealthController();
```

## 10. Развертывание

### 10.1 Railway конфигурация

```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm start"
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

### 10.2 Package.json scripts

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js",
    "test": "echo 'Tests not implemented yet' && exit 0",
    "lint": "echo 'Linting not implemented yet' && exit 0"
  }
}
```

## 11. Тестирование

### 11.1 Тестовые endpoints

```javascript
// Для тестирования в development режиме
if (process.env.NODE_ENV === 'development') {
  app.post('/test/webhook', (req, res) => {
    // Simulate telegram message for testing
    const testMessage = {
      message: {
        message_id: 1,
        from: { id: 12345, first_name: 'Test' },
        chat: { id: 12345, type: 'private' },
        date: Math.floor(Date.now() / 1000),
        text: req.body.text || '/start'
      }
    };
    
    telegramController.handleWebhook({ body: testMessage }, res);
  });
}
```

### 11.2 Тестовые сценарии

#### Тест интеграции с Piapi
```bash
curl -X POST http://localhost:3000/test/piapi \
  -H "Content-Type: application/json" \
  -d '{"userPhotoUrl": "test_url", "templateUrl": "test_template"}'
```

#### Тест создания стикер-пака
```bash
curl -X POST http://localhost:3000/test/sticker \
  -H "Content-Type: application/json" \
  -d '{"userId": 12345, "imageBuffer": "base64_data"}'
```

## 12. Производительность и оптимизация

### 12.1 Оптимизации

#### Connection pooling для HTTP запросов
```javascript
const axios = require('axios');
const { Agent } = require('https');

const httpsAgent = new Agent({
  keepAlive: true,
  maxSockets: 10
});

const axiosInstance = axios.create({
  httpsAgent,
  timeout: 30000
});
```

#### Кэширование результатов (если необходимо)
```javascript
const cache = new Map();

function getCachedResult(key) {
  return cache.get(key);
}

function setCachedResult(key, value, ttl = 300000) { // 5 minutes
  cache.set(key, value);
  setTimeout(() => cache.delete(key), ttl);
}
```

### 12.2 Мониторинг производительности

```javascript
// Middleware для измерения времени ответа
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });
  
  next();
});
```

## 13. Безопасность

### 13.1 Middleware безопасности

```javascript
// src/middleware/authMiddleware.js
const crypto = require('crypto');

function verifyTelegramWebhook(req, res, next) {
  const secret = crypto.createHash('sha256')
    .update(process.env.TELEGRAM_BOT_TOKEN)
    .digest();
    
  const signature = req.headers['x-telegram-bot-api-secret-token'];
  
  // В production следует проверять подпись
  if (process.env.NODE_ENV === 'production' && !signature) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  next();
}

module.exports = { verifyTelegramWebhook };
```

### 13.2 Rate limiting

```javascript
// src/middleware/rateLimitMiddleware.js
const rateLimits = new Map();

function rateLimitMiddleware(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 30;

  if (!rateLimits.has(ip)) {
    rateLimits.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  const limit = rateLimits.get(ip);
  
  if (now > limit.resetTime) {
    limit.count = 1;
    limit.resetTime = now + windowMs;
    return next();
  }

  if (limit.count >= maxRequests) {
    return res.status(429).json({ error: 'Too many requests' });
  }

  limit.count++;
  next();
}

module.exports = rateLimitMiddleware;
```

---

## Заключение

Данная backend спецификация предоставляет полную техническую реализацию для Telegram бота создания мемных стикер-паков. Архитектура оптимизирована для простоты разработки, надежности и масштабируемости.

**Ключевые особенности:**
- ✅ Модульная архитектура с разделением ответственности
- ✅ Полная интеграция с внешними API
- ✅ Надежная обработка ошибок
- ✅ Логирование и мониторинг
- ✅ Безопасность и валидация
- ✅ Готовность к развертыванию на Railway