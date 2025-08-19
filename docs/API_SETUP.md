# Настройка внешних API для New People Stickers Bot

## 🤖 Telegram Bot API

### Шаг 1: Создание бота через @BotFather

1. **Откройте Telegram** и найдите бота [@BotFather](https://t.me/botfather)
2. **Начните диалог** и отправьте команду `/start`
3. **Создайте нового бота** командой `/newbot`
4. **Введите имя бота** (например: "New People Stickers Bot")
5. **Введите username бота** (должен заканчиваться на "bot", например: "NewPeopleStickers_bot")

### Шаг 2: Получение и настройка токена

1. **Скопируйте токен** из сообщения BotFather (формат: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)
2. **Добавьте в .env файл:**
   ```env
   TELEGRAM_BOT_TOKEN=ваш_токен_здесь
   ```

### Шаг 3: Настройка бота

1. **Установите описание бота** (опционально):
   ```
   /setdescription
   Создавайте уникальные стикер-паки с вашим лицом! Просто отправьте фото и получите набор мемных стикеров.
   ```

2. **Установите команды бота** (опционально):
   ```
   /setcommands
   start - Начать создание стикер-пака
   help - Помощь по использованию
   ```

3. **Настройте изображение бота** (опционально):
   ```
   /setuserpic
   ```

### Шаг 4: Тестирование

```bash
node test-telegram-api.js
```

---

## 🎨 Piapi AI API

### Шаг 1: Регистрация в Piapi AI

1. **Перейдите на сайт** https://api.piapi.ai
2. **Зарегистрируйтесь** или войдите в существующий аккаунт
3. **Подтвердите email** если требуется

### Шаг 2: Создание API ключа

1. **Войдите в панель управления** (Dashboard)
2. **Найдите раздел API Keys** или Settings
3. **Создайте новый API ключ:**
   - Название: "New People Stickers Bot"
   - Права: Face Swap operations
4. **Скопируйте сгенерированный ключ**

### Шаг 3: Настройка переменных окружения

Добавьте в ваш `.env` файл:

```env
PIAPI_API_KEY=ваш_api_ключ_здесь
PIAPI_BASE_URL=https://api.piapi.ai/api/v1
```

### Шаг 4: Проверка лимитов и тарифов

1. **Проверьте ваш тарифный план** в личном кабинете
2. **Убедитесь в достаточном количестве кредитов** для тестирования
3. **Изучите лимиты по запросам** (requests per minute/hour)

### Шаг 5: Тестирование

```bash
node test-piapi-api.js
```

---

## 🔧 Переменные окружения

Полный файл `.env` должен содержать:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Telegram Bot
TELEGRAM_BOT_TOKEN=ваш_telegram_bot_token
TELEGRAM_WEBHOOK_URL=https://your-domain.railway.app/webhook

# Piapi AI
PIAPI_API_KEY=ваш_piapi_api_key
PIAPI_BASE_URL=https://api.piapi.ai/api/v1

# Supabase
SUPABASE_URL=https://ydpciztfzextfjkqdapa.supabase.co
SUPABASE_ANON_KEY=ваш_supabase_anon_key

# App Configuration
MAX_PROCESSING_TIME=30000
STATUS_CHECK_INTERVAL=3000
```

---

## 🧪 Тестирование всех API

### Запуск всех тестов:

```bash
node test-apis.js
```

### Индивидуальные тесты:

```bash
# Только Telegram API
node test-telegram-api.js

# Только Piapi AI
node test-piapi-api.js

# База данных
node test-db.js
```

---

## ✅ Контрольный список

- [ ] **Telegram бот создан** через @BotFather
- [ ] **Bot token получен** и добавлен в .env
- [ ] **Piapi AI аккаунт** зарегистрирован
- [ ] **Piapi API key** получен и добавлен в .env
- [ ] **Все тесты проходят** успешно
- [ ] **Переменные окружения** настроены корректно

---

## 🚨 Troubleshooting

### Ошибки Telegram API

**401 Unauthorized:**
- Проверьте правильность токена
- Убедитесь, что токен не содержит лишних пробелов
- Проверьте, что бот не был удален в @BotFather

**404 Not Found:**
- Убедитесь, что бот существует
- Проверьте актуальность токена

### Ошибки Piapi AI

**401 Unauthorized:**
- Проверьте правильность API ключа
- Убедитесь, что ключ активен
- Проверьте срок действия ключа

**429 Too Many Requests:**
- Превышен лимит запросов
- Подождите и повторите попытку
- Проверьте ваш тарифный план

**402 Payment Required:**
- Недостаточно кредитов на аккаунте
- Пополните баланс или смените тарифный план

### Общие ошибки

**ECONNREFUSED / ENOTFOUND:**
- Проверьте интернет соединение
- Убедитесь в правильности URL endpoints
- Проверьте настройки прокси/файрволла

---

## 📚 Полезные ссылки

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Piapi AI Documentation](https://api.piapi.ai/docs)
- [BotFather Commands](https://core.telegram.org/bots#botfather)

---

## 🔐 Безопасность

**⚠️ ВАЖНО:**
- Никогда не коммитьте файл `.env` в Git
- Не делитесь API ключами публично
- Регулярно обновляйте ключи доступа
- Используйте переменные окружения в продакшене