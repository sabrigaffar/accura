-- ============================================
-- حذف البيانات التجريبية - النسخة المُبسطة
-- ============================================
-- هذا السكريبت مُبسط جداً وآمن
-- يحذف فقط من auth.users والباقي سيُحذف تلقائياً

-- ====================
-- الخطوة 1: حذف المستخدمين التجريبيين
-- ====================

DELETE FROM auth.users 
WHERE email LIKE '%test%' 
   OR email LIKE '%demo%'
   OR email LIKE '%example%'
   OR email LIKE '%@test.%'
   OR email LIKE '%@example.%';

-- ✅ تم! هذا سيحذف تلقائياً من:
-- - profiles
-- - orders
-- - products  
-- - notifications
-- - push_tokens
-- - conversation_participants
-- (بسبب ON DELETE CASCADE)

-- ====================
-- الخطوة 2 (اختياري): تنظيف إضافي
-- ====================

-- حذف profiles بأسماء تجريبية (إن وجدت)
DELETE FROM profiles 
WHERE full_name LIKE '%تجريبي%'
   OR full_name LIKE '%Test%'
   OR full_name LIKE '%Demo%';

-- حذف المحادثات الفارغة
DELETE FROM conversations 
WHERE id NOT IN (
  SELECT DISTINCT conversation_id 
  FROM conversation_participants
);

-- حذف الرسائل اليتيمة
DELETE FROM messages 
WHERE conversation_id NOT IN (
  SELECT id FROM conversations
);

-- ====================
-- الخطوة 3: التحقق من النتائج
-- ====================

-- عدد المستخدمين المتبقين
SELECT 
  COALESCE(user_type, 'NULL') as user_type,
  COUNT(*) as count
FROM profiles
GROUP BY user_type
ORDER BY user_type;

-- إحصائيات شاملة
SELECT 'auth.users' as table_name, COUNT(*) as count FROM auth.users
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
SELECT 'push_tokens', COUNT(*) FROM push_tokens;

-- ✅ النتيجة المثالية:
-- جميع الأعداد = 0 (أو أعداد صغيرة للمستخدمين الحقيقيين)
