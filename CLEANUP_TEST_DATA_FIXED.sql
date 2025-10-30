-- ============================================
-- حذف جميع البيانات التجريبية - النسخة المُصححة
-- ============================================
-- ⚠️ تحذير: هذا السكريبت سيحذف جميع البيانات التجريبية!
-- يُنصح بعمل Backup قبل التنفيذ

-- ====================
-- الطريقة الصحيحة:
-- حذف من auth.users سيحذف تلقائياً من profiles
-- بسبب ON DELETE CASCADE
-- ====================

-- ====================
-- 1. حذف المستخدمين التجريبيين
-- ====================

-- حذف جميع المستخدمين الذين لديهم emails تجريبية
DELETE FROM auth.users 
WHERE email LIKE '%test%' 
   OR email LIKE '%demo%'
   OR email LIKE '%example%'
   OR email LIKE '%@test.%'
   OR email LIKE '%@example.%';

-- ✅ هذا سيحذف تلقائياً:
-- - profiles (بسبب CASCADE)
-- - orders المرتبطة
-- - products المرتبطة
-- - notifications المرتبطة
-- - push_tokens المرتبطة
-- - conversation_participants المرتبطة

-- ====================
-- 2. تنظيف البيانات اليتيمة (Orphaned Data)
-- ====================

-- حذف الطلبات بدون عملاء
DELETE FROM orders 
WHERE customer_id NOT IN (SELECT id FROM profiles);

-- حذف الطلبات بدون تجار
DELETE FROM orders 
WHERE merchant_id NOT IN (SELECT id FROM profiles);

-- حذف المنتجات بدون تجار
DELETE FROM products 
WHERE merchant_id NOT IN (SELECT id FROM profiles);

-- حذف التقييمات بدون منتجات
DELETE FROM reviews 
WHERE product_id NOT IN (SELECT id FROM products);

-- حذف الإشعارات بدون مستخدمين
DELETE FROM notifications 
WHERE user_id NOT IN (SELECT id FROM profiles);

-- حذف Push Tokens بدون مستخدمين
DELETE FROM push_tokens 
WHERE user_id NOT IN (SELECT id FROM profiles);

-- حذف رسائل المحادثات اليتيمة
DELETE FROM messages 
WHERE conversation_id NOT IN (SELECT id FROM conversations);

-- حذف المشاركين في المحادثات اليتيمة
DELETE FROM conversation_participants 
WHERE conversation_id NOT IN (SELECT id FROM conversations);

-- حذف المحادثات الفارغة (بدون مشاركين)
DELETE FROM conversations 
WHERE id NOT IN (
  SELECT DISTINCT conversation_id 
  FROM conversation_participants
);

-- ====================
-- 3. حذف profiles بناءً على الاسم (إضافي)
-- ====================

-- حذف profiles التي تحتوي على أسماء تجريبية
DELETE FROM profiles 
WHERE full_name LIKE '%تجريبي%'
   OR full_name LIKE '%Test%'
   OR full_name LIKE '%Demo%'
   OR full_name LIKE '%Example%'
   OR full_name LIKE '%مستخدم تجريبي%';

-- ====================
-- ✅ تم! جميع البيانات التجريبية محذوفة
-- ====================

-- ====================
-- 4. التحقق من النتائج
-- ====================

-- عدد المستخدمين المتبقين حسب النوع
SELECT 
  user_type,
  COUNT(*) as count
FROM profiles
GROUP BY user_type
ORDER BY user_type;

-- عدد المنتجات
SELECT 'products' as table_name, COUNT(*) as count FROM products
UNION ALL
-- عدد الطلبات
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
-- عدد الإشعارات
SELECT 'notifications', COUNT(*) FROM notifications
UNION ALL
-- عدد المحادثات
SELECT 'conversations', COUNT(*) FROM conversations
UNION ALL
-- عدد الرسائل
SELECT 'messages', COUNT(*) FROM messages
UNION ALL
-- عدد Push Tokens
SELECT 'push_tokens', COUNT(*) FROM push_tokens;

-- إذا كانت جميع الأعداد = 0، فقاعدة البيانات نظيفة تماماً! ✅
