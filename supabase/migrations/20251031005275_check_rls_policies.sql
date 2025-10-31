-- التحقق من سياسات RLS الحالية على جدول orders

-- 1. عرض جميع policies على جدول orders
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
WHERE tablename = 'orders'
ORDER BY policyname;

-- 2. عرض فقط policies السائقين
SELECT 
  policyname,
  cmd,
  qual
FROM pg_policies 
WHERE tablename = 'orders' 
  AND policyname LIKE '%Driver%'
ORDER BY policyname;
