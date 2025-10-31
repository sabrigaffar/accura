-- تشخيص مشكلة full_name في orders
-- تاريخ: 2025-10-28

-- 1. فحص جميع triggers على جدول orders
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'orders';

-- 2. فحص جميع functions المرتبطة بـ orders
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines
WHERE routine_name LIKE '%order%'
  AND routine_type = 'FUNCTION';

-- 3. فحص RLS policies على جدول orders
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'orders';

-- 4. فحص أعمدة جدول orders
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;
