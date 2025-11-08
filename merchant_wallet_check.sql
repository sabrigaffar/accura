-- استعلام شامل للتحقق من محفظة التاجر وكل المعاملات
-- انسخ هذا الاستعلام كاملاً وشغّله في Supabase SQL Editor

-- 1) آخر 10 طلبات delivered للتحقق من payment_method والبيانات
SELECT 
  o.id,
  o.order_number,
  o.payment_method,
  o.merchant_id,
  o.subtotal,
  o.product_total,
  o.tax,
  o.tax_amount,
  o.status,
  o.delivered_at,
  m.name_ar as merchant_name
FROM orders o
LEFT JOIN merchants m ON m.id = o.merchant_id
WHERE o.status = 'delivered'
ORDER BY o.delivered_at DESC NULLS LAST, o.updated_at DESC
LIMIT 10;

-- 2) كل محافظ التجار الموجودة
SELECT 
  w.id as wallet_id,
  w.owner_id as merchant_id,
  w.balance,
  w.currency,
  w.created_at,
  m.name_ar as merchant_name,
  m.owner_id as merchant_owner_user_id
FROM wallets w
LEFT JOIN merchants m ON m.id = w.owner_id
WHERE w.owner_type = 'merchant'
ORDER BY w.created_at DESC;

-- 3) كل معاملات محافظ التجار
SELECT 
  wt.id,
  wt.type,
  wt.amount,
  wt.memo,
  wt.created_at,
  o.order_number,
  o.payment_method,
  w.owner_id as merchant_id,
  m.name_ar as merchant_name
FROM wallet_transactions wt
JOIN wallets w ON w.id = wt.wallet_id
LEFT JOIN orders o ON o.id = wt.related_order_id
LEFT JOIN merchants m ON m.id = w.owner_id
WHERE w.owner_type = 'merchant'
ORDER BY wt.created_at DESC
LIMIT 50;

-- 4) إحصائيات: كم طلب delivered بطريقة card؟
SELECT 
  payment_method,
  COUNT(*) as orders_count,
  SUM(COALESCE(subtotal, 0) + COALESCE(tax, 0)) as total_merchant_amount,
  COUNT(DISTINCT merchant_id) as merchants_count
FROM orders
WHERE status = 'delivered'
GROUP BY payment_method
ORDER BY orders_count DESC;
