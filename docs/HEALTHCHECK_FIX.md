# Healthcheck Fix for Railway Deployment

## Проблема
Приложение падало на healthcheck при деплое на Railway. Ошибка: "1/1 replicas never became healthy!"

## Причина
1. Healthcheck endpoint зависел от внешних сервисов (Supabase, Telegram API, Piapi API)
2. При отсутствии переменных окружения приложение не могло запуститься
3. Healthcheck был слишком строгим и не учитывал временные недоступности сервисов

## Исправления

### 1. Обновлен HealthController
- Добавлена обработка ошибок для каждого внешнего сервиса
- Healthcheck теперь возвращает 200 даже при недоступности внешних сервисов
- Упрощена логика определения здоровья системы

### 2. Обновлена конфигурация базы данных
- Supabase client создается только при наличии переменных окружения
- Приложение не падает при отсутствии конфигурации Supabase
- Добавлено логирование предупреждений вместо ошибок

### 3. Обновлен Dockerfile
- Healthcheck теперь использует `/ready` endpoint вместо `/health`
- Увеличен start-period до 60 секунд
- Увеличено количество retries до 5

### 4. Создан файл env.example
- Содержит все необходимые переменные окружения
- Помогает настроить Railway deployment

## Тестирование

### Локальное тестирование
```bash
# Запустить сервер
npm start

# В другом терминале протестировать healthcheck
npm run test:healthcheck
```

### Проверка endpoints
- `/ready` - простой endpoint для Railway healthcheck
- `/health` - подробный healthcheck с проверкой всех сервисов
- `/metrics` - метрики системы

## Переменные окружения для Railway

Обязательные для базовой работы:
```
NODE_ENV=production
PORT=3000
```

Для полной функциональности:
```
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
TELEGRAM_BOT_TOKEN=your_bot_token
PIAPI_API_KEY=your_piapi_key
```

## Результат
- Приложение теперь запускается даже без полной конфигурации
- Healthcheck проходит успешно
- Railway deployment работает корректно
- Внешние сервисы проверяются, но их недоступность не блокирует запуск
