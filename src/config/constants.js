/**
 * Application constants
 * Contains messages, configuration values, and other constants
 */

// Bot messages in Russian
const MESSAGES = {
  // Welcome and help messages
  WELCOME: `🎭 <b>Добро пожаловать в Стикеры Новых Людей!</b>

Этот бот создаёт персональные стикер-паки с вашим лицом на популярных мемах!

<b>Как это работает:</b>
• Отправьте мне свою фотографию
• Я создам стикер-пак с вашим лицом на 10 мем-шаблонах
• Вы получите ссылку на готовый стикер-пак

<b>Правила:</b>
• 1 стикер-пак в день на пользователя
• Фото должно быть чётким и с хорошо видимым лицом
• Обработка занимает 5-10 минут

Отправьте фотографию, чтобы начать! 📸`,

  HELP: `📋 <b>Помощь по боту</b>

<b>Команды:</b>
/start - Приветственное сообщение
/help - Эта справка

<b>Как создать стикер-пак:</b>
1. Отправьте мне фотографию
2. Дождитесь завершения обработки
3. Получите ссылку на готовый стикер-пак

<b>Требования к фото:</b>
• Формат: JPG, PNG
• Лицо должно быть хорошо видно
• Желательно фото анфас
• Хорошее освещение

<b>Ограничения:</b>
• 1 стикер-пак в день
• Время обработки: 5-10 минут

По вопросам: @support`,

  // Processing messages
  PHOTO_RECEIVED: `📷 <b>Фотография получена!</b>

Начинаю создание вашего персонального стикер-пака...

Это может занять 5-10 минут. Я отправлю вам ссылку, когда всё будет готово! ⏳`,

  PROCESSING_STARTED: `🎨 <b>Обработка началась!</b>

Создаю стикеры с вашим лицом на мем-шаблонах:
• Проверяю качество фотографии
• Применяю AI face-swap технологию
• Генерирую стикеры в формате WebP
• Собираю стикер-пак

Скоро всё будет готово! 🚀`,

  PROCESSING_PROGRESS: (completed, total) => 
    `🎨 <b>Обрабатываю стикеры: ${completed}/${total}</b>

${completed < total ? '⏳ Осталось немного времени...' : '✅ Все стикеры готовы!'}`,

  CREATING_PACK: `📦 <b>Создаю стикер-пак...</b>

Почти готово! Собираю все стикеры в один пак...`,

  // Success messages
  STICKERS_READY: (packUrl, packName) => 
    `🎉 <b>Ваши стикеры готовы!</b>

Ваш персональный стикер-пак успешно создан!

<b>📦 Как использовать:</b>
• Нажмите кнопку "Открыть стикер-пак"
• Добавьте стикеры в свой Telegram
• Используйте в чатах и беседах!

<b>🚀 Поделитесь с друзьями:</b>
• Нажмите кнопку "Поделиться с друзьями"
• Покажите свой уникальный стикер-пак всем!


Спасибо за использование Стикеров Новых Людей! 🎭`,

  // Error messages
  DAILY_LIMIT_EXCEEDED: `⏰ <b>Дневной лимит исчерпан</b>

Вы уже создали стикер-пак сегодня. Попробуйте завтра!

<b>Лимиты:</b>
• 1 стикер-пак в день на пользователя
• Обновление в 00:00 UTC

Увидимся завтра! 👋`,

  PROCESSING_ERROR: `❌ <b>Ошибка при обработке</b>

К сожалению, произошла ошибка при создании стикер-пака.

<b>Возможные причины:</b>
• Проблемы с AI-сервисом
• Плохое качество фотографии
• Технические неполадки

Попробуйте ещё раз с другой фотографией или обратитесь в поддержку.`,

  INVALID_PHOTO: `📸 <b>Неподходящая фотография</b>

Не удалось обработать вашу фотографию.

<b>Требования:</b>
• Лицо должно быть хорошо видно
• Формат: JPG или PNG
• Хорошее освещение
• Фото анфас предпочтительно

Попробуйте отправить другую фотографию! 📷`,

  SEND_PHOTO_ONLY: `📸 <b>Отправьте фотографию</b>

Для создания стикер-пака мне нужна ваша фотография.

Отправьте фото (не файлом), и я создам персональный стикер-пак! 

<i>Примечание: текстовые сообщения я не обрабатываю</i>`,

  UNSUPPORTED_MESSAGE: `❓ <b>Неподдерживаемый тип сообщения</b>

Я умею обрабатывать только фотографии для создания стикер-паков.

<b>Отправьте:</b>
• Фотографию (не файлом)
• /start - для начала работы
• /help - для получения справки

Других типов сообщений я пока не понимаю! 🤖`,

  PROCESSING_IN_PROGRESS: `⏳ <b>Обработка уже идёт</b>

Я уже создаю стикер-пак с вашей предыдущей фотографией.

Подождите, пока процесс завершится, затем можете отправить новое фото (завтра).

Терпение! Скоро всё будет готово! ⏱️`,

  // System messages
  BOT_STARTED: `🤖 <b>Бот запущен!</b>

New People Stickers Bot готов к работе.
Отправьте /start чтобы начать!`,

  MAINTENANCE_MODE: `🔧 <b>Технические работы</b>

Бот временно недоступен из-за технических работ.

Примерное время восстановления: 30 минут.
Попробуйте позже!

Приносим извинения за неудобства! 🙏`,

  SERVICE_ERROR: `⚠️ <b>Сервис временно недоступен</b>

Возникли технические проблемы. Мы уже работаем над их устранением.

Попробуйте позже или обратитесь в поддержку, если проблема повторяется.`,

  // Admin messages (for future use)
  STATS_MESSAGE: (stats) => 
    `📊 <b>Статистика бота</b>

<b>Пользователи:</b> ${stats.totalUsers}
<b>Всего стикер-паков:</b> ${stats.totalGenerations}
<b>Паков сегодня:</b> ${stats.dailyGenerations}
<b>Успешность:</b> ${stats.successRate}%

<b>Время:</b> ${new Date().toLocaleString('ru-RU')}`
};

// Configuration constants
const CONFIG = {
  // Limits
  DAILY_LIMIT: 1,
  MAX_PROCESSING_TIME: 10 * 60 * 1000, // 10 minutes
  STICKER_COUNT: 10,

  // Timeouts
  WEBHOOK_TIMEOUT: 30000,
  API_TIMEOUT: 30000,
  PROCESSING_TIMEOUT: 600000, // 10 minutes

  // Image requirements
  MAX_IMAGE_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_FORMATS: ['image/jpeg', 'image/png'],
  
  // Sticker requirements (Telegram)
  STICKER_MAX_SIZE: 512,
  STICKER_FORMAT: 'webp',
  MAX_STICKER_FILE_SIZE: 500 * 1024, // 500KB

  // Retry settings
  MAX_RETRIES: 3,
  RETRY_DELAY: 2000,

  // Polling intervals
  STATUS_CHECK_INTERVAL: 3000,
  PROGRESS_UPDATE_INTERVAL: 30000
};

// Meme templates with emojis
const MEME_TEMPLATES = [
  {
    name: 'Drake Pointing',
    url: 'https://drive.google.com/uc?id=1a2b3c4d5e6f7g8h9i0j',
    emoji: '👉'
  },
  {
    name: 'Distracted Boyfriend',
    url: 'https://drive.google.com/uc?id=1b2c3d4e5f6g7h8i9j0k',
    emoji: '👀'
  },
  {
    name: 'This Is Fine',
    url: 'https://drive.google.com/uc?id=1c2d3e4f5g6h7i8j9k0l',
    emoji: '🔥'
  },
  {
    name: 'Expanding Brain',
    url: 'https://drive.google.com/uc?id=1d2e3f4g5h6i7j8k9l0m',
    emoji: '🧠'
  },
  {
    name: 'Woman Yelling at Cat',
    url: 'https://drive.google.com/uc?id=1e2f3g4h5i6j7k8l9m0n',
    emoji: '😾'
  },
  {
    name: 'Change My Mind',
    url: 'https://drive.google.com/uc?id=1f2g3h4i5j6k7l8m9n0o',
    emoji: '💭'
  },
  {
    name: 'Surprised Pikachu',
    url: 'https://drive.google.com/uc?id=1g2h3i4j5k6l7m8n9o0p',
    emoji: '😮'
  },
  {
    name: 'Stonks',
    url: 'https://drive.google.com/uc?id=1h2i3j4k5l6m7n8o9p0q',
    emoji: '📈'
  },
  {
    name: 'Always Has Been',
    url: 'https://drive.google.com/uc?id=1i2j3k4l5m6n7o8p9q0r',
    emoji: '🔫'
  },
  {
    name: 'Leonardo DiCaprio Cheers',
    url: 'https://drive.google.com/uc?id=1j2k3l4m5n6o7p8q9r0s',
    emoji: '🥂'
  }
];

// Error codes and types
const ERROR_TYPES = {
  VALIDATION_ERROR: 'ValidationError',
  PROCESSING_ERROR: 'ProcessingError',
  TIMEOUT_ERROR: 'TimeoutError',
  API_ERROR: 'ApiError',
  DATABASE_ERROR: 'DatabaseError',
  CONFIGURATION_ERROR: 'ConfigurationError',
  RATE_LIMIT_ERROR: 'RateLimitError'
};

// Bot states (for conversation flow)
const BOT_STATES = {
  IDLE: 'idle',
  WAITING_PHOTO: 'waiting_photo',
  PROCESSING: 'processing',
  ERROR: 'error',
  COMPLETED: 'completed'
};

// Logging levels and categories
const LOG_CATEGORIES = {
  WEBHOOK: 'webhook',
  PROCESSING: 'processing',
  API_CALL: 'api_call',
  USER_ACTION: 'user_action',
  ERROR: 'error',
  SYSTEM: 'system',
  SECURITY: 'security',
  GENERATION: 'generation',
  METRIC: 'metric'
};

// Environment validation
const REQUIRED_ENV_VARS = [
  'BOT_TOKEN',
  'PIAPI_API_KEY',
  'WEBHOOK_URL'
];

// Rate limiting constants
const RATE_LIMITS = {
  // Per user limits
  MESSAGES_PER_MINUTE: 10,
  REQUESTS_PER_HOUR: 60,
  
  // Global limits
  CONCURRENT_PROCESSING: 5,
  MAX_QUEUE_SIZE: 100,
  
  // API limits
  TELEGRAM_API_LIMIT: 30, // requests per second
  PIAPI_API_LIMIT: 10    // requests per second
};

// Circuit breaker settings
const CIRCUIT_BREAKER = {
  FAILURE_THRESHOLD: 5,     // failures before opening circuit
  TIMEOUT: 60000,          // ms to wait before retrying
  MONITOR_INTERVAL: 10000  // ms between health checks
};

// Validation settings
const VALIDATION = {
  // Image validation
  MIN_IMAGE_WIDTH: 100,
  MIN_IMAGE_HEIGHT: 100,
  MAX_IMAGE_ASPECT_RATIO: 3.0,
  
  // Text validation
  MAX_MESSAGE_LENGTH: 4096,
  MAX_CALLBACK_DATA_LENGTH: 64,
  
  // File validation
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png'],
  MIN_FACE_CONFIDENCE: 0.8
};

// Performance monitoring
const PERFORMANCE = {
  // Response time thresholds (ms)
  FAST_RESPONSE: 1000,
  ACCEPTABLE_RESPONSE: 3000,
  SLOW_RESPONSE: 5000,
  
  // Memory thresholds (MB)
  MEMORY_WARNING: 512,
  MEMORY_CRITICAL: 1024,
  
  // Processing thresholds
  MAX_CONCURRENT_JOBS: 3,
  JOB_TIMEOUT: 600000 // 10 minutes
};

// Error recovery settings
const ERROR_RECOVERY = {
  MAX_CONSECUTIVE_FAILURES: 3,
  BACKOFF_MULTIPLIER: 2,
  MAX_BACKOFF_TIME: 30000,
  HEALTH_CHECK_INTERVAL: 30000
};

module.exports = {
  MESSAGES,
  CONFIG,
  MEME_TEMPLATES,
  ERROR_TYPES,
  BOT_STATES,
  LOG_CATEGORIES,
  REQUIRED_ENV_VARS,
  RATE_LIMITS,
  CIRCUIT_BREAKER,
  VALIDATION,
  PERFORMANCE,
  ERROR_RECOVERY
};