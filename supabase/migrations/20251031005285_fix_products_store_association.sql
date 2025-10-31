-- إصلاح ربط المنتجات بالمتاجر الصحيحة
-- تاريخ: 2025-10-28
-- المشكلة: المنتجات تظهر في جميع متاجر التاجر بدلاً من المتجر المحدد فقط

-- الحل: إضافة store_id إلى جدول products

-- 1. إضافة عمود store_id
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    -- 1. إضافة عمود store_id
    ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES merchants(id) ON DELETE CASCADE;

    -- 2. تحديث المنتجات الموجودة
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
  END IF;
END $$;
