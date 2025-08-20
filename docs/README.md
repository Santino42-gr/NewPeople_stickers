# New People Stickers Bot - Документация

## 📚 Обзор документации

Добро пожаловать в техническую документацию Telegram бота для создания персональных стикер-паков с использованием ИИ для замены лиц.

## 🗂️ Структура документации

### 🚀 Быстрый старт
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Развертывание на Railway
- **[API_SETUP.md](./API_SETUP.md)** - Настройка внешних API
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Настройка базы данных

### 🏗️ Архитектура
- **[telegram-bot-backend-spec.md](./telegram-bot-backend-spec.md)** - Backend архитектура
- **[telegram-bot-frontend-spec.md](./telegram-bot-frontend-spec.md)** - Frontend (Telegram UI)

### 🧪 Тестирование
- **[TESTING.md](./TESTING.md)** - Руководство по тестированию

### 🔧 Операционная поддержка
- **[STICKER_FIXES.md](./STICKER_FIXES.md)** - Исправления и решения проблем

## 🎯 Быстрая навигация

### Для разработчиков
1. **Первый запуск**: [API_SETUP.md](./API_SETUP.md) → [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
2. **Локальная разработка**: [telegram-bot-backend-spec.md](./telegram-bot-backend-spec.md)
3. **Тестирование**: [TESTING.md](./TESTING.md)
4. **Деплоймент**: [DEPLOYMENT.md](./DEPLOYMENT.md)

### Для DevOps
1. **Развертывание**: [DEPLOYMENT.md](./DEPLOYMENT.md)
2. **Мониторинг**: Health checks в [DEPLOYMENT.md](./DEPLOYMENT.md)
3. **Troubleshooting**: [STICKER_FIXES.md](./STICKER_FIXES.md)

### Для продуктовой команды
1. **Пользовательский опыт**: [telegram-bot-frontend-spec.md](./telegram-bot-frontend-spec.md)
2. **Архитектура**: [telegram-bot-backend-spec.md](./telegram-bot-backend-spec.md)

## 🛠️ Технический стек

### Backend
- **Node.js** 18+ с Express.js
- **Telegram Bot API** для интерфейса
- **Piapi AI** для face-swap
- **Supabase** (PostgreSQL) для данных
- **Railway** для хостинга

### Основные сервисы
- `telegramService` - работа с Telegram API
- `stickerService` - создание стикер-паков  
- `piapiService` - ИИ обработка изображений
- `imageService` - обработка изображений
- `userLimitsService` - лимиты пользователей

## 📊 Архитектурная диаграмма

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Telegram  │───▶│   Backend   │───▶│   Piapi AI  │
│     Bot     │    │   Server    │    │    Service  │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  Supabase   │
                   │ (PostgreSQL) │
                   └─────────────┘
```

## 🔄 Рабочий процесс

1. **Пользователь** отправляет фото в Telegram бота
2. **Backend** обрабатывает webhook от Telegram
3. **Piapi AI** выполняет face-swap с мем-шаблонами
4. **Sticker Service** создает стикер-пак в Telegram
5. **Пользователь** получает ссылку на готовый стикер-пак

## 🔐 Безопасность

- Rate limiting (30 req/min)
- Input validation
- Webhook signature verification
- Anti-spam protection
- Memory protection

## 📈 Мониторинг

### Health Check Endpoints
- `/health` - полная проверка системы
- `/ready` - готовность сервера
- `/metrics` - метрики производительности

### Логирование
- Структурированные JSON логи
- Отслеживание пользовательских действий
- Мониторинг ошибок API

## 🚦 Статус сервисов

Для проверки статуса всех сервисов:
```bash
npm run test:deployment
```

## 📝 Changelog

### Последние изменения
- ✅ Исправлена ошибка `STICKERSET_INVALID`
- ✅ Добавлены готовые стикеры (11, 12)
- ✅ Улучшена обработка ошибок
- ✅ Консолидирована документация

## 🆘 Поддержка

### Частые проблемы
1. **Стикеры не создаются**: См. [STICKER_FIXES.md](./STICKER_FIXES.md)
2. **API не отвечает**: Проверить переменные окружения
3. **База данных недоступна**: Проверить Supabase подключение

### Контакты
- **Разработчик**: AIronLab Team
- **Репозиторий**: GitHub (ссылка в README.md)
- **Задачи**: Linear AIL-32

## 📚 Дополнительные ресурсы

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [Piapi AI Documentation](https://api.piapi.ai/docs)
- [Railway Documentation](https://docs.railway.app/)
- [Supabase Documentation](https://supabase.com/docs)

---

**Последнее обновление**: 20 августа 2025  
**Версия документации**: 1.0  
**Совместимо с**: Node.js 18+, Telegram Bot API 7.0+
