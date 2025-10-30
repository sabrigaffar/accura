-- ============================================
-- فحص بنية قاعدة البيانات
-- ============================================

-- 1. فحص أعمدة جدول profiles
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- 2. عرض جميع المستخدمين الحاليين
SELECT 
  id,
  email,
  full_name,
  user_type,
  created_at
FROM profiles
ORDER BY created_at DESC
LIMIT 10;

-- 3. إحصائيات سريعة
SELECT 
  'profiles' as table_name,
  COUNT(*) as count
FROM profiles
UNION ALL
SELECT 
  'products',
  COUNT(*)
FROM products
UNION ALL
SELECT 
  'orders',
  COUNT(*)
FROM orders
UNION ALL
SELECT 
  'notifications',
  COUNT(*)
FROM notifications
UNION ALL
SELECT 
  'conversations',
  COUNT(*)
FROM conversations
UNION ALL
SELECT 
  'messages',
  COUNT(*)
FROM messages;
