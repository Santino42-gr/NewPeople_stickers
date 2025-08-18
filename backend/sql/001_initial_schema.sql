-- Initial database schema for New People Stickers bot
-- Execute this in Supabase SQL Editor

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

-- Таблица для логирования операций
CREATE TABLE generation_logs (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),
  error_message TEXT,
  processing_time_ms INTEGER,
  sticker_pack_name VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индекс для поиска логов по пользователю
CREATE INDEX idx_generation_logs_user_id ON generation_logs(user_id);

-- Индекс для поиска логов по дате
CREATE INDEX idx_generation_logs_created_at ON generation_logs(created_at);

-- Индекс для поиска логов по статусу
CREATE INDEX idx_generation_logs_status ON generation_logs(status);

-- Комментарии к таблицам
COMMENT ON TABLE user_limits IS 'Таблица для отслеживания лимитов генерации стикер-паков пользователями';
COMMENT ON TABLE generation_logs IS 'Таблица для логирования всех операций генерации стикер-паков';

-- Комментарии к колонкам
COMMENT ON COLUMN user_limits.user_id IS 'Telegram user ID';
COMMENT ON COLUMN user_limits.last_generation IS 'Дата последней генерации стикер-пака';
COMMENT ON COLUMN user_limits.total_generations IS 'Общее количество созданных паков';

COMMENT ON COLUMN generation_logs.user_id IS 'Telegram user ID';
COMMENT ON COLUMN generation_logs.status IS 'Статус операции: started, completed, failed';
COMMENT ON COLUMN generation_logs.processing_time_ms IS 'Время обработки в миллисекундах';
COMMENT ON COLUMN generation_logs.sticker_pack_name IS 'Имя созданного стикер-пака';