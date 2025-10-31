-- إصلاح Foreign Key في order_items
-- تاريخ: 2025-10-28
-- المشكلة: order_items يشير إلى merchant_products بدلاً من products

-- 1. حذف Foreign Key القديم
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

-- 2. إضافة Foreign Key الجديد الصحيح
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='products'
  ) THEN
    -- If a unified products table exists, reference it
    ALTER TABLE order_items 
    ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES products(id) 
    ON DELETE SET NULL;
  ELSE
    -- Otherwise, keep referencing merchant_products (legacy schema)
    ALTER TABLE order_items 
    ADD CONSTRAINT order_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES merchant_products(id) 
    ON DELETE SET NULL;
  END IF;
END $$;

-- 3. التحقق من النجاح
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname = 'order_items_product_id_fkey';

-- يجب أن ترى:
-- order_items_product_id_fkey | order_items | products
