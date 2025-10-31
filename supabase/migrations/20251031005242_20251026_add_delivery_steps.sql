-- إضافة أعمدة لتتبع خطوات التوصيل التفصيلية
-- Migration: Add delivery step tracking columns

-- إضافة الأعمدة إن لم تكن موجودة
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_merchant_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_customer_at TIMESTAMP;

-- إضافة تعليقات للتوضيح
COMMENT ON COLUMN orders.picked_up_at IS 'وقت استلام الطلب من المتجر';
COMMENT ON COLUMN orders.heading_to_merchant_at IS 'وقت بداية التوجه للمتجر';
COMMENT ON COLUMN orders.heading_to_customer_at IS 'وقت بداية التوجه للعميل';

-- إضافة index للأداء
CREATE INDEX IF NOT EXISTS idx_orders_delivery_steps 
ON orders(driver_id, picked_up_at, heading_to_customer_at) 
WHERE driver_id IS NOT NULL;
