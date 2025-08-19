# Настройка Supabase для New People Stickers Bot

## Шаги настройки

### 1. Создание проекта в Supabase

1. Перейти на https://supabase.com
2. Войти в аккаунт или зарегистрироваться
3. Нажать "New Project"
4. Выбрать организацию
5. Указать название проекта: `new-people-stickers-bot`
6. Задать пароль для базы данных (сохранить его!)
7. Выбрать регион (желательно ближайший к пользователям)
8. Нажать "Create new project"

### 2. Выполнение SQL миграции

1. В проекте Supabase перейти в раздел "SQL Editor"
2. Создать новый запрос
3. Скопировать содержимое файла `sql/001_initial_schema.sql`
4. Вставить в редактор и выполнить (Run)
5. Проверить, что таблицы созданы в разделе "Table Editor"

### 3. Получение API ключей

1. Перейти в раздел "Settings" → "API"
2. Скопировать следующие значения:
   - **Project URL** (например: `https://abcdefgh.supabase.co`)
   - **Anon public** ключ (начинается с `eyJ...`)

### 4. Настройка переменных окружения

Добавить в файл `.env` (создать из `.env.example`):

```env
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
```

### 5. Настройка RLS (Row Level Security)

**Важно!** По умолчанию Supabase включает RLS. Для нашего бота нужно отключить или настроить политики:

#### Вариант 1: Отключить RLS (для разработки)
```sql
ALTER TABLE user_limits DISABLE ROW LEVEL SECURITY;
ALTER TABLE generation_logs DISABLE ROW LEVEL SECURITY;
```

#### Вариант 2: Настроить политики (для продакшн)
```sql
-- Разрешить все операции для service role
CREATE POLICY "Allow all for service role" ON user_limits
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow all for service role" ON generation_logs
    FOR ALL USING (auth.role() = 'service_role');
```

### 6. Тестирование подключения

Выполнить простой запрос для проверки:

```sql
SELECT 'Database connection works!' as message;
```

## Структура таблиц

### user_limits
- `id` - автоинкремент primary key
- `user_id` - Telegram user ID (уникальный)
- `last_generation` - дата последней генерации
- `total_generations` - общее количество паков
- `created_at`, `updated_at` - временные метки

### generation_logs
- `id` - автоинкремент primary key  
- `user_id` - Telegram user ID
- `status` - статус операции ('started', 'completed', 'failed')
- `error_message` - сообщение об ошибке (если есть)
- `processing_time_ms` - время обработки в мс
- `sticker_pack_name` - имя созданного пака
- `created_at` - время создания записи

## Оптимизация

Созданы индексы для оптимизации частых запросов:
- `user_id` для обеих таблиц
- `created_at` и `status` для generation_logs

## Проверка работы

После настройки можно протестировать подключение через Supabase client в коде приложения.