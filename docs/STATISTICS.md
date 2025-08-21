# 📊 Система статистики New People Stickers Bot

## 🎯 Обзор

Система статистики предоставляет детальную аналитику использования Telegram бота через REST API endpoints. Позволяет отслеживать количество пользователей, генераций стикер-паков, успешность операций и детальную статистику по каждому пользователю.

## 🚀 API Endpoints

### 1. Общая статистика бота
```
GET /api/stats
```

**Описание**: Возвращает общую статистику использования бота

**Пример ответа**:
```json
{
  "success": true,
  "data": {
    "totalUsers": 7,
    "totalGenerations": 7,
    "dailyGenerations": 13,
    "successRate": 41.94,
    "generatedAt": "2025-08-21T14:02:09.179Z"
  }
}
```

**Метрики**:
- `totalUsers` - количество уникальных пользователей
- `totalGenerations` - общее количество созданных стикер-паков
- `dailyGenerations` - количество операций за текущий день
- `successRate` - процент успешных генераций

### 2. Статистика конкретного пользователя
```
GET /api/stats/user/:userId
```

**Параметры**:
- `userId` (number) - Telegram user ID

**Пример ответа**:
```json
{
  "success": true,
  "data": {
    "userId": 123456789,
    "totalGenerations": 2,
    "lastGeneration": "2025-08-21",
    "canGenerateToday": false,
    "successfulGenerations": 1,
    "failedGenerations": 1,
    "recentLogs": [
      {
        "id": 15,
        "status": "completed",
        "created_at": "2025-08-21T12:00:00.000Z",
        "processing_time_ms": 45000,
        "sticker_pack_name": "user123456789_20250821_1634"
      }
    ],
    "generatedAt": "2025-08-21T14:02:10.344Z"
  }
}
```

### 3. Проверка работоспособности статистики
```
GET /api/stats/health
```

**Описание**: Проверяет состояние сервиса статистики и подключение к базе данных

**Пример ответа** (здоровый сервис):
```json
{
  "success": true,
  "status": "healthy", 
  "database": "connected",
  "lastCheck": "2025-08-21T14:02:09.914Z",
  "basicStats": {
    "totalUsers": 7,
    "hasError": false
  }
}
```

**Пример ответа** (проблемы с БД):
```json
{
  "success": false,
  "status": "degraded",
  "database": "not_configured",
  "lastCheck": "2025-08-21T14:02:09.914Z"
}
```

## 🔧 Техническая реализация

### Архитектура
- **Контроллер**: `src/controllers/statsController.js`
- **Сервис**: Использует существующий `userLimitsService`
- **База данных**: Существующие таблицы Supabase
- **Безопасность**: Rate limiting, валидация, обработка ошибок

### Используемые таблицы Supabase

#### user_limits
```sql
CREATE TABLE user_limits (
  id SERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE NOT NULL,
  last_generation DATE NOT NULL DEFAULT CURRENT_DATE,
  total_generations INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### generation_logs
```sql
CREATE TABLE generation_logs (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  processing_time_ms INTEGER,
  sticker_pack_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Обработка ошибок

Система использует **fail-safe подход**:
- При недоступности БД возвращает дефолтные значения
- Детальное логирование всех операций
- Graceful degradation - сервис остается доступным

## 🛡️ Безопасность

### Rate Limiting
Все endpoints защищены rate limiting:
```javascript
rateLimitMiddleware.limitByIP.bind(rateLimitMiddleware)
```

### Валидация
- Проверка корректности `userId` (число)
- Валидация входных параметров
- Санитизация ответов

### Обработка ошибок
```javascript
errorHandler.asyncHandler(statsController.getStats.bind(statsController))
```

## 📈 Мониторинг и интеграция

### Использование в мониторинге

**Prometheus/Grafana**:
```bash
# Общая статистика
curl -s http://your-domain.com/api/stats | jq '.data.totalUsers'

# Health check для алертов
curl -f http://your-domain.com/api/stats/health
```

**Дашборды**:
```javascript
// Пример интеграции в React
const fetchStats = async () => {
  const response = await fetch('/api/stats');
  const stats = await response.json();
  setDashboardData(stats.data);
};
```

### Интеграция с внешними системами

**Webhook для уведомлений**:
```bash
# Отправка метрик в Slack/Discord
STATS=$(curl -s http://your-domain.com/api/stats)
USERS=$(echo $STATS | jq '.data.totalUsers')
echo "Пользователей бота: $USERS"
```

## 🧪 Тестирование

### Локальное тестирование
```bash
# Запуск сервера
npm start

# Тестирование endpoints
curl http://localhost:3000/api/stats
curl http://localhost:3000/api/stats/health
curl http://localhost:3000/api/stats/user/123456789
```

### Production тестирование
```bash
# Замените your-domain.railway.app на ваш домен
curl https://your-domain.railway.app/api/stats
curl https://your-domain.railway.app/api/stats/health
```

## 🚨 Troubleshooting

### Статус коды ошибок

| Код | Описание | Решение |
|-----|----------|---------|
| 200 | Успех | - |
| 400 | Некорректный userId | Проверить формат userId |
| 503 | БД недоступна | Проверить подключение к Supabase |
| 500 | Внутренняя ошибка | Проверить логи сервера |

### Частые проблемы

**Ошибка "Statistics service not available"**:
```bash
# Проверить переменные окружения
echo $SUPABASE_URL
echo $SUPABASE_ANON_KEY

# Проверить подключение к Supabase
curl -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/"
```

**Нулевые значения в статистике**:
- Проверить наличие данных в таблицах `user_limits` и `generation_logs`
- Убедиться в корректности SQL запросов

## 📊 Примеры использования

### Простой мониторинг
```bash
#!/bin/bash
# stats-monitor.sh

STATS=$(curl -s http://localhost:3000/api/stats)
USERS=$(echo $STATS | jq '.data.totalUsers')
SUCCESS_RATE=$(echo $STATS | jq '.data.successRate')

echo "📊 Статистика бота:"
echo "👥 Пользователей: $USERS"
echo "✅ Success rate: $SUCCESS_RATE%"
```

### Интеграция в Node.js
```javascript
const axios = require('axios');

async function getBotStats() {
  try {
    const response = await axios.get('/api/stats');
    const { totalUsers, totalGenerations, successRate } = response.data.data;
    
    console.log(`Пользователей: ${totalUsers}`);
    console.log(`Генераций: ${totalGenerations}`);
    console.log(`Success rate: ${successRate}%`);
    
    return response.data.data;
  } catch (error) {
    console.error('Ошибка получения статистики:', error.message);
  }
}
```

### Создание отчетов
```python
import requests
import json
from datetime import datetime

def generate_daily_report():
    response = requests.get('http://localhost:3000/api/stats')
    stats = response.json()['data']
    
    report = f"""
📊 Ежедневный отчет - {datetime.now().strftime('%Y-%m-%d')}

👥 Всего пользователей: {stats['totalUsers']}
🎨 Всего генераций: {stats['totalGenerations']}
📅 Генераций сегодня: {stats['dailyGenerations']}
✅ Success rate: {stats['successRate']}%
    """
    
    print(report)
    return report
```

## 🔗 Дополнительные ресурсы

- **API Reference**: Полное описание всех endpoints
- **Database Schema**: [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- **Deployment**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Testing**: [TESTING.md](./TESTING.md)

---

**Последнее обновление**: 21 августа 2025  
**Версия**: 1.0  
**Задача**: AIL-46
