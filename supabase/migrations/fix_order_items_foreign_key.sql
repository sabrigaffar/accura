-- إصلاح Foreign Key في order_items
-- تاريخ: 2025-10-28
-- المشكلة: order_items يشير إلى merchant_products بدلاً من products

-- 1. حذف Foreign Key القديم
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;

-- 2. إضافة Foreign Key الجديد الصحيح
ALTER TABLE order_items 
ADD CONSTRAINT order_items_product_id_fkey 
FOREIGN KEY (product_id) 
REFERENCES products(id) 
ON DELETE SET NULL;

-- 3. التحقق من النجاح
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname = 'order_items_product_id_fkey';

-- يجب أن ترى:
-- order_items_product_id_fkey | order_items | products
