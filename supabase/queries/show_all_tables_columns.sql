-- ═══════════════════════════════════════════════════════════════════════════════
-- استعلام شامل لعرض جميع الجداول والأعمدة في قاعدة البيانات (Table Editor)
-- يمكن تشغيله في Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- 🔍 الاستعلام الرئيسي: عرض كل جدول مع جميع أعمدته وتفاصيلها الكاملة
SELECT 
    t.table_name AS "الجدول",
    c.ordinal_position AS "#",
    c.column_name AS "العمود",
    c.data_type AS "النوع",
    CASE 
        WHEN c.character_maximum_length IS NOT NULL 
        THEN c.data_type || '(' || c.character_maximum_length || ')'
        WHEN c.numeric_precision IS NOT NULL 
        THEN c.data_type || '(' || c.numeric_precision || ',' || COALESCE(c.numeric_scale, 0) || ')'
        ELSE c.data_type
    END AS "النوع الكامل",
    CASE 
        WHEN c.is_nullable = 'YES' THEN '✓'
        ELSE '✗'
    END AS "NULL",
    COALESCE(c.column_default, '-') AS "الافتراضي",
    CASE 
        WHEN pk.column_name IS NOT NULL THEN '🔑 PK'
        WHEN fk.column_name IS NOT NULL THEN '🔗 FK → ' || fk.foreign_table
        ELSE ''
    END AS "المفتاح",
    CASE 
        WHEN col_desc.description IS NOT NULL THEN col_desc.description
        ELSE ''
    END AS "الوصف"
FROM 
    information_schema.tables t
JOIN 
    information_schema.columns c 
    ON t.table_name = c.table_name 
    AND t.table_schema = c.table_schema
-- Primary Keys
LEFT JOIN (
    SELECT 
        ku.table_name, 
        ku.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
-- Foreign Keys
LEFT JOIN (
    SELECT 
        ku.table_name,
        ku.column_name,
        ccu.table_name AS foreign_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage ku
        ON tc.constraint_name = ku.constraint_name
        AND tc.table_schema = ku.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON tc.constraint_name = ccu.constraint_name
        AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
) fk ON c.table_name = fk.table_name AND c.column_name = fk.column_name
-- Column descriptions (comments)
LEFT JOIN (
    SELECT 
        c.relname AS table_name,
        a.attname AS column_name,
        d.description
    FROM pg_class c
    JOIN pg_attribute a ON c.oid = a.attrelid
    LEFT JOIN pg_description d ON c.oid = d.objoid AND a.attnum = d.objsubid
    JOIN pg_namespace n ON c.relnamespace = n.oid
    WHERE n.nspname = 'public'
        AND a.attnum > 0
        AND NOT a.attisdropped
) col_desc ON c.table_name = col_desc.table_name AND c.column_name = col_desc.column_name
WHERE 
    t.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
ORDER BY 
    t.table_name, 
    c.ordinal_position;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 📊 استعلام إضافي: ملخص سريع لعدد الأعمدة في كل جدول
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
    table_name AS "اسم الجدول",
    COUNT(*) AS "عدد الأعمدة",
    STRING_AGG(column_name, ', ' ORDER BY ordinal_position) AS "قائمة الأعمدة"
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public'
GROUP BY 
    table_name
ORDER BY 
    table_name;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 🔗 استعلام إضافي: عرض جميع العلاقات (Foreign Keys) بين الجداول
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
    tc.table_name AS "الجدول الأصلي",
    kcu.column_name AS "العمود",
    ccu.table_name AS "الجدول المرجعي",
    ccu.column_name AS "العمود المرجعي",
    tc.constraint_name AS "اسم القيد"
FROM 
    information_schema.table_constraints tc
JOIN 
    information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN 
    information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
    AND tc.table_schema = ccu.table_schema
WHERE 
    tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY 
    tc.table_name, kcu.column_name;
