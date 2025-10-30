-- إضافة عمود store_id إلى جدول orders
-- Add store_id column to orders table

-- إضافة العمود
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS store_id UUID;

-- إضافة مفتاح أجنبي يربط بجدول merchants
ALTER TABLE orders
ADD CONSTRAINT orders_store_id_fkey 
FOREIGN KEY (store_id) 
REFERENCES merchants(id) 
ON DELETE SET NULL;

-- إنشاء فهرس لتحسين الأداء
CREATE INDEX IF NOT EXISTS orders_store_id_idx ON orders(store_id);

-- تحديث السجلات الموجودة: ربط الطلبات بالمتجر الأول للتاجر
-- Update existing records: link orders to the merchant's first store
UPDATE orders o
SET store_id = (
  SELECT m.id 
  FROM merchants m 
  WHERE m.owner_id = o.merchant_id 
  ORDER BY m.created_at ASC 
  LIMIT 1
)
WHERE store_id IS NULL;

-- إضافة تعليق على العمود
COMMENT ON COLUMN orders.store_id IS 'معرف المتجر الذي تم إجراء الطلب منه - Store ID where the order was placed';
