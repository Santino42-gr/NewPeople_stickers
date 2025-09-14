# 📢 Система массовой рассылки New People Stickers Bot

Система позволяет отправлять текстовые сообщения и изображения всем зарегистрированным пользователям бота.

## 🚀 Быстрый старт

### 1. Установка зависимостей

```bash
npm install multer
```

### 2. Настройка базы данных

Выполните SQL схему из `src/config/broadcast-schema.sql` в вашей Supabase базе данных:

```sql
-- Создание таблиц для системы рассылки
-- Скопируйте и выполните содержимое файла src/config/broadcast-schema.sql
```

### 3. Создание директории для загрузки файлов

```bash
mkdir -p uploads/broadcast
```

## 📋 API Эндпоинты

Все административные эндпоинты требуют авторизации через заголовок `X-API-Key`.

### Создание рассылки

```bash
POST /admin/broadcast/create
```

**Параметры:**
- `name` (string) - Название кампании
- `messageText` (string, optional) - Текст сообщения  
- `imageCaption` (string, optional) - Подпись к изображению
- `campaignType` (string) - Тип кампании: `text_only`, `image_only`, `text_and_image`
- `image` (file, optional) - Изображение для отправки

**Пример (текстовая рассылка):**

```bash
curl -X POST "http://localhost:3000/admin/broadcast/create" \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Новогоднее поздравление",
    "messageText": "🎉 С Новым Годом! Желаем счастья и удачи в новом году!",
    "campaignType": "text_only"
  }'
```

**Пример (рассылка с изображением):**

```bash
curl -X POST "http://localhost:3000/admin/broadcast/create" \
  -H "X-API-Key: your-api-key" \
  -F "name=Новая коллекция стикеров" \
  -F "messageText=🎨 Новая коллекция стикеров уже доступна!" \
  -F "imageCaption=Посмотрите на наши новые мемы" \
  -F "campaignType=text_and_image" \
  -F "image=@/path/to/your/image.png"
```

### Запуск рассылки

```bash
POST /admin/broadcast/:campaignId/start
```

**Пример:**

```bash
curl -X POST "http://localhost:3000/admin/broadcast/abc123-def456/start" \
  -H "X-API-Key: your-api-key"
```

### Статус рассылки

```bash
GET /admin/broadcast/:campaignId/status
```

**Пример:**

```bash
curl -X GET "http://localhost:3000/admin/broadcast/abc123-def456/status" \
  -H "X-API-Key: your-api-key"
```

**Ответ:**

```json
{
  "success": true,
  "campaign": {
    "id": "abc123-def456",
    "name": "Новогоднее поздравление",
    "campaign_type": "text_only",
    "status": "completed",
    "total_recipients": 150,
    "successful_deliveries": 145,
    "failed_deliveries": 3,
    "blocked_users": 2,
    "success_rate_percent": 96.67,
    "created_at": "2025-01-01T00:00:00.000Z",
    "started_at": "2025-01-01T10:00:00.000Z",
    "completed_at": "2025-01-01T10:05:30.000Z"
  }
}
```

### Список всех рассылок

```bash
GET /admin/broadcast/list?status=completed&limit=10&offset=0
```

**Параметры:**
- `status` (optional) - Фильтр по статусу: `created`, `in_progress`, `completed`, `failed`, `cancelled`
- `limit` (optional) - Количество записей (1-100, по умолчанию 50)
- `offset` (optional) - Смещение (по умолчанию 0)

### Отмена рассылки

```bash
POST /admin/broadcast/:campaignId/cancel
```

**Пример:**

```bash
curl -X POST "http://localhost:3000/admin/broadcast/abc123-def456/cancel" \
  -H "X-API-Key: your-api-key"
```

### Проверка здоровья системы

```bash
GET /admin/broadcast/health
```

## 🧪 Тестирование

### Автоматическое тестирование

```bash
npm run test:broadcast
```

### Ручное тестирование

**Создание текстовой рассылки:**

```bash
node test-broadcast.js create-text "Тестовая рассылка" "Привет! Это тестовое сообщение."
```

**Запуск рассылки:**

```bash
node test-broadcast.js start campaign-id-here
```

**Полный набор тестов:**

```bash
node test-broadcast.js
```

## 📊 Статистика и мониторинг

### Статусы кампаний

- `created` - Кампания создана, но не запущена
- `in_progress` - Рассылка выполняется
- `completed` - Рассылка завершена успешно
- `failed` - Рассылка завершена с ошибкой
- `cancelled` - Рассылка отменена

### Статусы доставки

- `pending` - Ожидает отправки
- `sent` - Успешно отправлено
- `failed` - Ошибка отправки
- `blocked` - Пользователь заблокировал бота

### Просмотр прогресса

Статус рассылки обновляется в реальном времени. Вы можете периодически проверять прогресс через API.

## ⚡ Производительность и лимиты

### Telegram API лимиты

- ⏱️ **Rate Limit**: 30 сообщений в секунду
- 🔄 **Retry**: Автоматические повторы при временных ошибках
- 📦 **Batch Size**: Обработка по 50 получателей за раз

### Системные ограничения

- 📝 **Текст сообщения**: максимум 4096 символов
- 🖼️ **Размер изображения**: максимум 10MB
- 📑 **Подпись изображения**: максимум 1024 символа
- 📛 **Название кампании**: максимум 255 символов

## 🔐 Безопасность

### API ключи

Все админские эндпоинты требуют валидный API ключ в заголовке `X-API-Key`.

### Авторизация

```javascript
headers: {
  'X-API-Key': 'your-secret-api-key'
}
```

### Rate Limiting

Все эндпоинты защищены rate limiting для предотвращения злоупотреблений.

## 🐛 Обработка ошибок

### Типичные ошибки

**403 Forbidden** - Пользователь заблокировал бота
```json
{
  "error": "Bot was blocked by the user",
  "code": "USER_BLOCKED"
}
```

**400 Bad Request** - Неверные параметры
```json
{
  "error": "Message text is required for text campaigns", 
  "code": "MISSING_MESSAGE_TEXT"
}
```

**404 Not Found** - Кампания не найдена
```json
{
  "error": "Campaign not found",
  "code": "CAMPAIGN_NOT_FOUND"
}
```

**503 Service Unavailable** - Сервис не настроен
```json
{
  "error": "Broadcast service not configured",
  "code": "SERVICE_UNAVAILABLE"
}
```

## 📁 Структура файлов

```
src/
├── services/
│   └── broadcastService.js      # Основная логика рассылки
├── controllers/
│   └── broadcastController.js   # HTTP контроллер
├── config/
│   └── broadcast-schema.sql     # SQL схема БД
└── uploads/
    └── broadcast/               # Загруженные изображения
```

## 🛠️ Разработка

### Добавление новых типов кампаний

1. Обновите `campaignType` enum в SQL схеме
2. Добавьте обработку в `broadcastService.js`
3. Обновите валидацию в `broadcastController.js`

### Кастомизация шаблонов сообщений

Вы можете добавить поддержку переменных в текстах сообщений:

```javascript
const personalizedMessage = messageText.replace('{firstName}', user.firstName);
```

### Мониторинг производительности

Все операции логируются с метриками времени выполнения для мониторинга производительности.

## 🔄 Восстановление после сбоев

В случае сбоя во время рассылки:

1. Проверьте статус кампании через API
2. Сообщения с статусом `pending` можно переотправить
3. Система автоматически отмечает заблокированных пользователей

## 📈 Масштабирование

Для больших объемов рассылки:

1. Увеличьте `batchSize` в конфигурации
2. Настройте connection pooling для базы данных
3. Рассмотрите использование очередей (Redis/Bull)

## ❓ FAQ

**Q: Как отправить рассылку только активным пользователям?**
A: Система автоматически получает список пользователей из таблицы `user_limits`. Пользователи добавляются туда при первом использовании бота.

**Q: Можно ли запланировать рассылку на будущее?**
A: Сейчас поддерживается только немедленная отправка. Для отложенной отправки используйте cron jobs или планировщик задач.

**Q: Как обработать большие изображения?**
A: Система автоматически оптимизирует изображения через Sharp. Максимальный размер файла - 10MB.

**Q: Что происходит, если пользователь заблокировал бота?**
A: Система автоматически определяет заблокированных пользователей и помечает их статусом `blocked`. Это не влияет на остальную рассылку.

## 🆘 Поддержка

При возникновении проблем:

1. Проверьте логи сервера
2. Убедитесь, что база данных настроена корректно
3. Проверьте, что API ключи валидны
4. Запустите `npm run test:broadcast` для диагностики