-- ============================================
-- حذف جميع البيانات التجريبية
-- ============================================
-- ⚠️ تحذير: هذا السكريبت سيحذف جميع البيانات التجريبية!
-- يُنصح بعمل Backup قبل التنفيذ

-- ====================
-- 1. حذف بيانات التجار
-- ====================

-- حذف المنتجات التجريبية
DELETE FROM products 
WHERE merchant_id IN (
  SELECT id FROM profiles 
  WHERE email LIKE '%test%' 
  OR email LIKE '%demo%'
  OR email LIKE '%example%'
);

-- حذف الطلبات التجريبية
DELETE FROM orders 
WHERE merchant_id IN (
  SELECT id FROM profiles 
  WHERE email LIKE '%test%' 
  OR email LIKE '%demo%'
  OR email LIKE '%example%'
);

-- حذف التقييمات التجريبية
DELETE FROM reviews 
WHERE merchant_id IN (
  SELECT id FROM profiles 
  WHERE email LIKE '%test%' 
  OR email LIKE '%demo%'
  OR email LIKE '%example%'
);

-- ====================
-- 2. حذف بيانات السائقين
-- ====================

-- حذف الطلبات المسندة للسائقين التجريبيين
UPDATE orders 
SET driver_id = NULL 
WHERE driver_id IN (
  SELECT id FROM profiles 
  WHERE user_type = 'driver' 
  AND (
    email LIKE '%test%' 
    OR email LIKE '%demo%'
    OR email LIKE '%example%'
  )
);

-- ====================
-- 3. حذف بيانات العملاء
-- ====================

-- حذف طلبات العملاء التجريبيين
DELETE FROM orders 
WHERE customer_id IN (
  SELECT id FROM profiles 
  WHERE user_type = 'customer' 
  AND (
    email LIKE '%test%' 
    OR email LIKE '%demo%'
    OR email LIKE '%example%'
  )
);

-- حذف عناوين العملاء التجريبيين (إذا كان الجدول موجوداً)
DELETE FROM addresses 
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE email LIKE '%test%' 
  OR email LIKE '%demo%'
  OR email LIKE '%example%'
);

-- ====================
-- 4. حذف الإشعارات التجريبية
-- ====================

DELETE FROM notifications 
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE email LIKE '%test%' 
  OR email LIKE '%demo%'
  OR email LIKE '%example%'
);

-- ====================
-- 5. حذف المحادثات التجريبية
-- ====================

-- حذف الرسائل في محادثات المستخدمين التجريبيين
DELETE FROM messages 
WHERE conversation_id IN (
  SELECT DISTINCT cp.conversation_id 
  FROM conversation_participants cp
  WHERE cp.user_id IN (
    SELECT id FROM profiles 
    WHERE email LIKE '%test%' 
    OR email LIKE '%demo%'
    OR email LIKE '%example%'
  )
);

-- حذف المشاركات في المحادثات
DELETE FROM conversation_participants 
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE email LIKE '%test%' 
  OR email LIKE '%demo%'
  OR email LIKE '%example%'
);

-- حذف المحادثات الفارغة
DELETE FROM conversations 
WHERE id NOT IN (
  SELECT DISTINCT conversation_id 
  FROM conversation_participants
);

-- ====================
-- 6. حذف Push Tokens التجريبية
-- ====================

DELETE FROM push_tokens 
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE email LIKE '%test%' 
  OR email LIKE '%demo%'
  OR email LIKE '%example%'
);

-- ====================
-- 7. حذف ملفات التعريف التجريبية
-- ====================

DELETE FROM profiles 
WHERE email LIKE '%test%' 
OR email LIKE '%demo%'
OR email LIKE '%example%'
OR full_name LIKE '%تجريبي%'
OR full_name LIKE '%Test%'
OR full_name LIKE '%Demo%';

-- ====================
-- 8. حذف المستخدمين التجريبيين من Auth
-- ====================

-- ⚠️ ملاحظة: هذا سيحذف المستخدمين من جدول auth.users
-- تأكد من أنك تريد حذفهم نهائياً

DELETE FROM auth.users 
WHERE email LIKE '%test%' 
OR email LIKE '%demo%'
OR email LIKE '%example%';

-- ====================
-- 9. تنظيف إضافي (اختياري)
-- ====================

-- حذف الطلبات المعلقة بدون عملاء
DELETE FROM orders 
WHERE customer_id IS NULL;

-- حذف المنتجات بدون تاجر
DELETE FROM products 
WHERE merchant_id IS NULL;

-- حذف التقييمات اليتيمة (بدون منتج أو تاجر)
DELETE FROM reviews 
WHERE product_id NOT IN (SELECT id FROM products)
OR merchant_id NOT IN (SELECT id FROM profiles);

-- ====================
-- ✅ تم! جميع البيانات التجريبية محذوفة
-- ====================

-- للتحقق من عدد المستخدمين المتبقين:
SELECT 
  user_type,
  COUNT(*) as count
FROM profiles
GROUP BY user_type
ORDER BY user_type;

-- للتحقق من عدد الطلبات:
SELECT COUNT(*) as total_orders FROM orders;

-- للتحقق من عدد المنتجات:
SELECT COUNT(*) as total_products FROM products;
