# Testing Documentation

## Обзор тестирования

Проект включает несколько уровней тестирования для обеспечения качества и надежности.

## Структура тестов

### 🔧 Интеграционные тесты (корень проекта)

#### `test-apis.js`
- **Назначение**: Тестирование всех внешних API интеграций
- **Запуск**: `npm run test:apis` или `node test-apis.js`
- **Проверяет**:
  - Telegram Bot API подключение
  - Piapi AI API конфигурацию
  - Переменные окружения

#### `test-deployment.js` 
- **Назначение**: Тестирование деплоя и конфигурации
- **Запуск**: `npm run test:deployment` или `node test-deployment.js`
- **Проверяет**:
  - Здоровье сервиса
  - Готовность к продакшену
  - Конфигурацию окружения

#### `test-error-handling.js`
- **Назначение**: Тестирование обработки ошибок
- **Запуск**: `npm run test:error-handling` или `node test-error-handling.js`
- **Проверяет**:
  - Обработку ошибок API
  - Fail-safe механизмы
  - Логирование ошибок

#### `test-security.js`
- **Назначение**: Тестирование безопасности
- **Запуск**: `npm run test:security` или `node test-security.js`
- **Проверяет**:
  - Валидацию входных данных
  - Rate limiting
  - Защиту от атак

#### `test-faceswap.js`
- **Назначение**: Тестирование пайплайна face-swap
- **Запуск**: `node test-faceswap.js`
- **Проверяет**:
  - Полный цикл обработки изображений
  - Интеграцию с Piapi AI
  - Качество результата

### 🧪 Юнит-тесты (папка tests/)

#### `tests/telegramController-test.js`
- Тестирование контроллера Telegram webhook
- Обработка сообщений и команд

#### `tests/stickerService-test.js`
- Тестирование создания стикер-паков
- Telegram Sticker API интеграция

#### `tests/imageService-test.js`
- Обработка изображений
- Конвертация и оптимизация

#### `tests/piapiService-test.js`
- Интеграция с Piapi AI API
- Face-swap операции

#### `tests/userLimitsService-test.js`
- Система лимитов пользователей
- База данных операции

#### `tests/stickerGeneration-test.js`
- Полный процесс генерации стикеров
- End-to-end тестирование

## Запуск тестов

### Все тесты
```bash
npm test
```

### Группы тестов
```bash
# API интеграции
npm run test:apis

# Безопасность
npm run test:security

# Деплоймент
npm run test:deployment

# Обработка ошибок
npm run test:error-handling
```

### Отдельные тесты
```bash
# Юнит-тесты
node tests/telegramController-test.js
node tests/stickerService-test.js
node tests/userLimitsService-test.js

# Специфические тесты
node test-faceswap.js
```

## Требования для тестирования

### Переменные окружения
```env
TELEGRAM_BOT_TOKEN=your_bot_token
PIAPI_API_KEY=your_piapi_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
```

### Зависимости
- Node.js 18+
- Все npm пакеты установлены
- Доступ к внешним API

## Результаты тестов

### ✅ Успешный тест
- Все проверки пройдены
- API доступны
- Конфигурация корректна

### ❌ Неудачный тест
- Ошибки подключения к API
- Неправильная конфигурация
- Отсутствующие переменные окружения

## CI/CD Integration

Тесты автоматически запускаются при деплойменте через Railway:
1. Проверка переменных окружения
2. Тестирование API подключений
3. Валидация конфигурации
4. Деплоймент только при успешных тестах

## Добавление новых тестов

### Интеграционные тесты
1. Создать файл `test-[название].js` в корне
2. Добавить в `package.json` scripts
3. Документировать в этом файле

### Юнит-тесты
1. Создать файл в папке `tests/`
2. Следовать паттерну `[сервис]-test.js`
3. Использовать существующие утилиты тестирования

## Troubleshooting

### Частые проблемы
- **API недоступен**: Проверить ключи и интернет
- **Timeout ошибки**: Увеличить таймауты в тестах
- **Переменные окружения**: Проверить .env файл

### Отладка
```bash
# Проверка конфигурации
npm run validate-env

# Детальные логи
DEBUG=* node test-apis.js
```
