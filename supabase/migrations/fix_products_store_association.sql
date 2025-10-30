-- إصلاح ربط المنتجات بالمتاجر الصحيحة
-- تاريخ: 2025-10-28
-- المشكلة: المنتجات تظهر في جميع متاجر التاجر بدلاً من المتجر المحدد فقط

-- الحل: إضافة store_id إلى جدول products

-- 1. إضافة عمود store_id
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES merchants(id) ON DELETE CASCADE;

-- 2. تحديث المنتجات الموجودة
-- إذا كان merchant_id يشير إلى owner_id، نحتاج لربطها بـ store
UPDATE products p
SET store_id = (
  SELECT m.id 
  FROM merchants m 
  WHERE m.owner_id = p.merchant_id 
  LIMIT 1
)
WHERE store_id IS NULL;

-- 3. إضافة index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- 4. التحقق من النتيجة
SELECT 
  p.name,
  p.merchant_id as owner_id,
  p.store_id,
  m.name_ar as store_name
FROM products p
LEFT JOIN merchants m ON m.id = p.store_id
LIMIT 10;

-- ملاحظة: الآن يمكن استخدام store_id لجلب منتجات متجر محدد
-- بدلاً من merchant_id الذي يشير للتاجر (owner)
