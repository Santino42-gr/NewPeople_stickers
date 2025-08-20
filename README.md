# New People Stickers Bot 🤖

Telegram бот для создания персональных стикер-паков с использованием ИИ для замены лиц.

## 🎯 Что это?

Отправьте боту свое фото, и он создаст уникальный стикер-пак с вашим лицом на популярных мемах!

### ✨ Особенности
- 🤖 **ИИ замена лиц** через Piapi AI
- 📦 **Автоматическое создание** стикер-паков в Telegram
- 🎨 **10+ мем-шаблонов** для разнообразия
- ⚡ **Быстрая обработка** (5-10 минут)
- 🔒 **Безопасность** с rate limiting
- 📊 **Мониторинг** и логирование

## 🚀 Быстрый старт

### Попробовать бота
1. Найдите бота в Telegram: `@NewPeopleStickers_bot` (когда развернут)
2. Отправьте команду `/start`
3. Загрузите свое фото
4. Ждите ~5 минут
5. Получите ссылку на готовый стикер-пак!

### Развернуть самостоятельно

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https://github.com/Santino42-gr/NewPeople_stickers)

**Или вручную:**

1. **Клонировать репозиторий**
   ```bash
   git clone https://github.com/Santino42-gr/NewPeople_stickers.git
   cd NewPeople_stickers
   ```

2. **Установить зависимости**
   ```bash
   npm install
   ```

3. **Настроить API ключи**
   - 📱 [Создать Telegram бота](./docs/API_SETUP.md#telegram-bot-api)
   - 🤖 [Получить Piapi AI ключ](./docs/API_SETUP.md#piapi-ai-api)
   - 🗄️ [Настроить Supabase](./docs/SUPABASE_SETUP.md)

4. **Развернуть**
   - 🚂 [На Railway](./docs/DEPLOYMENT.md) (рекомендуется)
   - 🐳 [Через Docker](./docs/DEPLOYMENT.md#docker)
   - 💻 Локально: `npm start`

## 📚 Документация

### 📖 Полная документация: **[docs/README.md](./docs/README.md)**

### 🎯 Быстрые ссылки
- 🔧 **[Настройка API](./docs/API_SETUP.md)** - Telegram Bot, Piapi AI
- 🚀 **[Развертывание](./docs/DEPLOYMENT.md)** - Railway, Docker, мониторинг
- 🗄️ **[База данных](./docs/SUPABASE_SETUP.md)** - Supabase setup
- 🧪 **[Тестирование](./docs/TESTING.md)** - Юнит и интеграционные тесты
- 🏗️ **[Архитектура](./docs/telegram-bot-backend-spec.md)** - Backend specification
- 💬 **[UX/UI](./docs/telegram-bot-frontend-spec.md)** - Telegram interface
- 🔧 **[Troubleshooting](./docs/STICKER_FIXES.md)** - Решения проблем

## 🛠️ Технологии

### Backend
- **Node.js** 18+ с Express.js
- **Telegram Bot API** для интерфейса
- **Piapi AI** для ИИ обработки изображений
- **Sharp** для работы с изображениями
- **Supabase** (PostgreSQL) для хранения данных

### Deployment
- **Railway** - основная платформа хостинга
- **Docker** - контейнеризация
- **GitHub Actions** - CI/CD (планируется)

## 🧪 Тестирование

```bash
# Все тесты
npm test

# Проверка API
npm run test:apis

# Проверка деплоймента
npm run test:deployment

# Юнит-тесты
node tests/stickerService-test.js
```

Подробнее: **[docs/TESTING.md](./docs/TESTING.md)**

## 📊 Архитектура

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Telegram  │───▶│   Backend   │───▶│   Piapi AI  │
│     User    │    │   Server    │    │   Service   │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Supabase   │
                   │ (PostgreSQL) │
                   └─────────────┘
```

## 🔐 Переменные окружения

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_WEBHOOK_URL=https://your-domain.railway.app

# Piapi AI
PIAPI_API_KEY=your_piapi_key
PIAPI_BASE_URL=https://api.piapi.ai/api/v1

# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Server
PORT=3000
NODE_ENV=production
```

## 🤝 Contributing

1. **Fork** репозиторий
2. **Создайте** feature branch (`git checkout -b feature/amazing-feature`)
3. **Коммитьте** изменения (`git commit -m 'Add amazing feature'`)
4. **Push** в branch (`git push origin feature/amazing-feature`)
5. **Откройте** Pull Request

## 📋 TODO / Roadmap

- [ ] Добавить больше мем-шаблонов
- [ ] Реализовать пользовательские шаблоны
- [ ] Добавить анимированные стикеры
- [ ] Мультиязычная поддержка
- [ ] Улучшенный ИИ для лучшего качества
- [ ] Веб-интерфейс для администрирования

## 🐛 Известные проблемы

### ✅ Решенные
- ~~STICKERSET_INVALID ошибка~~ - **Исправлено** ✅
- ~~Дублирование стикеров~~ - **Исправлено** ✅
- ~~Проблемы с rate limiting~~ - **Исправлено** ✅

### 🔄 В работе  
- Оптимизация скорости обработки
- Улучшение качества face-swap
- Добавление прогресс-бара

Подробнее: **[docs/STICKER_FIXES.md](./docs/STICKER_FIXES.md)**

## 📞 Поддержка

- 📊 **Мониторинг**: `/health` endpoint
- 🐛 **Баги**: GitHub Issues
- 💬 **Вопросы**: Telegram или GitHub Discussions
- 📚 **Документация**: [docs/README.md](./docs/README.md)

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE) файл.

## 👏 Благодарности

- **Telegram** за Bot API
- **Piapi AI** за face-swap технологию
- **Railway** за простой деплоймент
- **Supabase** за backend-as-a-service

---

**Разработано** [AIronLab](https://github.com/Santino42-gr) с ❤️

**⭐ Поставьте звезду**, если проект был полезен!
