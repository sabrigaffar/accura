-- التحقق من هيكل قاعدة البيانات الفعلي

-- 1. التحقق من أعمدة جدول profiles
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. التحقق من أعمدة جدول orders
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 3. التحقق من أعمدة جدول addresses
SELECT 
    column_name, 
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'addresses'
ORDER BY ordinal_position;

-- 4. التحقق من الجداول الموجودة
SELECT 
    table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
