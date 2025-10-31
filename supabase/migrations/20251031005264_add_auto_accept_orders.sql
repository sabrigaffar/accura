-- إضافة عمود auto_accept_orders إلى جدول driver_profiles
ALTER TABLE driver_profiles 
ADD COLUMN IF NOT EXISTS auto_accept_orders BOOLEAN DEFAULT false;

-- إضافة تعليق توضيحي
COMMENT ON COLUMN driver_profiles.auto_accept_orders IS 'هل يقبل السائق الطلبات تلقائياً';
