-- ============================================
-- فحص بنية الجداول
-- ============================================

-- 1. فحص أعمدة جدول notifications
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'notifications'
ORDER BY ordinal_position;

-- 2. فحص أعمدة جدول push_tokens
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'push_tokens'
ORDER BY ordinal_position;

-- 3. فحص أعمدة جدول conversations
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'conversations'
ORDER BY ordinal_position;

-- 4. فحص أعمدة جدول messages
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'messages'
ORDER BY ordinal_position;
