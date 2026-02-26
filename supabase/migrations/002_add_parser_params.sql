-- Migration: Add parser parameters and account health
-- Date: 2026-02-17
-- Agent: A (Backend Integration)

-- ============================================
-- 1. Добавить параметры в parser_jobs
-- ============================================

ALTER TABLE parser_jobs 
ADD COLUMN IF NOT EXISTS min_revenue numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS max_results integer DEFAULT 50;

COMMENT ON COLUMN parser_jobs.min_revenue IS 'Минимальная месячная выручка для фильтрации (RUB)';
COMMENT ON COLUMN parser_jobs.category IS 'Категория товаров для парсинга';
COMMENT ON COLUMN parser_jobs.max_results IS 'Максимальное количество результатов';

-- ============================================
-- 2. Создать таблицу account_health
-- ============================================

CREATE TABLE IF NOT EXISTS account_health (
    id uuid default uuid_generate_v4() primary key,
    service_name text not null,
    status text check (status in ('healthy', 'degraded', 'down')) default 'healthy',
    last_check timestamp with time zone default timezone('utc'::text, now()),
    error_message text,
    metadata jsonb,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

COMMENT ON TABLE account_health IS 'Мониторинг здоровья внешних сервисов (WB API, Telegram, Email)';
COMMENT ON COLUMN account_health.service_name IS 'Название сервиса (WB_API, TELEGRAM, EMAIL)';
COMMENT ON COLUMN account_health.status IS 'Статус здоровья сервиса';
COMMENT ON COLUMN account_health.metadata IS 'Дополнительные данные (response_time, error_count, etc.)';

-- ============================================
-- 3. Индексы для производительности
-- ============================================

CREATE INDEX IF NOT EXISTS idx_account_health_service ON account_health(service_name);
CREATE INDEX IF NOT EXISTS idx_account_health_status ON account_health(status);
CREATE INDEX IF NOT EXISTS idx_account_health_last_check ON account_health(last_check DESC);

CREATE INDEX IF NOT EXISTS idx_parser_jobs_min_revenue ON parser_jobs(min_revenue);
CREATE INDEX IF NOT EXISTS idx_parser_jobs_category ON parser_jobs(category);

-- Seller pain profile used for personalized hooks/outreach
ALTER TABLE sellers
ADD COLUMN IF NOT EXISTS pain_points jsonb DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_sellers_pain_points_gin ON sellers USING GIN (pain_points);

-- ============================================
-- 4. Row Level Security (RLS)
-- ============================================

ALTER TABLE account_health ENABLE ROW LEVEL SECURITY;

-- Политика: разрешить все операции для anon (для MVP)
CREATE POLICY "Enable all access for anon" 
ON account_health 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- ============================================
-- 5. Функция для автоматического обновления updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Триггер для account_health
DROP TRIGGER IF EXISTS update_account_health_updated_at ON account_health;
CREATE TRIGGER update_account_health_updated_at
    BEFORE UPDATE ON account_health
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. Начальные данные для мониторинга
-- ============================================

INSERT INTO account_health (service_name, status, metadata)
VALUES 
    ('WB_API', 'healthy', '{"endpoint": "https://search.wb.ru", "last_response_time_ms": 0}'),
    ('TELEGRAM', 'healthy', '{"bot_active": false, "last_message_sent": null}'),
    ('EMAIL', 'healthy', '{"smtp_configured": false, "last_email_sent": null}')
ON CONFLICT DO NOTHING;

-- ============================================
-- 7. Проверка применения миграции
-- ============================================

-- Проверить новые колонки в parser_jobs
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'parser_jobs' AND column_name = 'min_revenue'
    ) THEN
        RAISE EXCEPTION 'Migration failed: min_revenue column not created';
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'account_health'
    ) THEN
        RAISE EXCEPTION 'Migration failed: account_health table not created';
    END IF;
    
    RAISE NOTICE '✅ Migration 002_add_parser_params applied successfully';
END $$;
