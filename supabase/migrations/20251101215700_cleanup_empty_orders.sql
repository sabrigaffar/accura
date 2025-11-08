-- حذف الطلبات التجريبية الفارغة (التي لا تحتوي على عناصر)
-- هذه الطلبات تم إنشاؤها أثناء اختبار إصلاح مشكلة unit_price

-- عرض الطلبات التي سيتم حذفها (للمراجعة)
SELECT 
    id,
    order_number,
    created_at,
    items_count,
    total,
    status
FROM orders
WHERE items_count = 0 OR items_count IS NULL
ORDER BY created_at DESC;

-- حذف الطلبات الفارغة
DELETE FROM orders
WHERE items_count = 0 OR items_count IS NULL;

-- عرض النتيجة
SELECT 
    COUNT(*) as "عدد الطلبات المتبقية",
    SUM(CASE WHEN items_count > 0 THEN 1 ELSE 0 END) as "طلبات صحيحة",
    SUM(CASE WHEN items_count = 0 OR items_count IS NULL THEN 1 ELSE 0 END) as "طلبات فارغة"
FROM orders;
