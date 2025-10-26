-- إصلاح شامل لجميع مشاكل السائق
-- Fix all driver-related issues

-- ==============================================
-- 1. إنشاء/إصلاح جدول driver_earnings
-- ==============================================

-- حذف الجدول القديم إن وجد (احتياطي)
DROP TABLE IF EXISTS driver_earnings CASCADE;

-- إنشاء الجدول الصحيح
CREATE TABLE driver_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  earned_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- تعليقات
COMMENT ON TABLE driver_earnings IS 'سجل أرباح السائقين من التوصيلات';
COMMENT ON COLUMN driver_earnings.amount IS 'مبلغ الأرباح (رسوم التوصيل)';
COMMENT ON COLUMN driver_earnings.earned_at IS 'وقت تحقيق الأرباح';

-- Indexes
CREATE INDEX idx_driver_earnings_driver ON driver_earnings(driver_id, earned_at DESC);
CREATE INDEX idx_driver_earnings_order ON driver_earnings(order_id);

-- RLS Policies
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view their own earnings" ON driver_earnings;
CREATE POLICY "Drivers can view their own earnings"
ON driver_earnings FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "System can insert earnings" ON driver_earnings;
CREATE POLICY "System can insert earnings"
ON driver_earnings FOR INSERT
TO authenticated
WITH CHECK (true);

-- ==============================================
-- 2. إضافة أعمدة خطوات التوصيل لجدول orders
-- ==============================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_merchant_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS heading_to_customer_at TIMESTAMP;

COMMENT ON COLUMN orders.picked_up_at IS 'وقت استلام الطلب من المتجر';
COMMENT ON COLUMN orders.heading_to_merchant_at IS 'وقت بداية التوجه للمتجر';
COMMENT ON COLUMN orders.heading_to_customer_at IS 'وقت بداية التوجه للعميل';

CREATE INDEX IF NOT EXISTS idx_orders_delivery_steps 
ON orders(driver_id, picked_up_at, heading_to_customer_at) 
WHERE driver_id IS NOT NULL;

-- ==============================================
-- 3. إنشاء جدول driver_cancellations
-- ==============================================

CREATE TABLE IF NOT EXISTS driver_cancellations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  cancelled_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE driver_cancellations IS 'سجل إلغاءات الطلبات من طرف السائقين';

CREATE INDEX IF NOT EXISTS idx_driver_cancellations_driver 
ON driver_cancellations(driver_id, cancelled_at DESC);

ALTER TABLE driver_cancellations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view their own cancellations" ON driver_cancellations;
CREATE POLICY "Drivers can view their own cancellations"
ON driver_cancellations FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can insert cancellations" ON driver_cancellations;
CREATE POLICY "Drivers can insert cancellations"
ON driver_cancellations FOR INSERT
TO authenticated
WITH CHECK (driver_id = auth.uid());

-- ==============================================
-- 4. إضافة إحداثيات GPS لجدول addresses
-- ==============================================

ALTER TABLE addresses 
ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

COMMENT ON COLUMN addresses.latitude IS 'خط العرض GPS';
COMMENT ON COLUMN addresses.longitude IS 'خط الطول GPS';

CREATE INDEX IF NOT EXISTS idx_addresses_coordinates 
ON addresses(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ==============================================
-- 5. التحقق من النتائج
-- ==============================================

-- عرض هيكل جدول driver_earnings
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'driver_earnings'
ORDER BY ordinal_position;

-- عرض الأعمدة الجديدة في orders
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('picked_up_at', 'heading_to_merchant_at', 'heading_to_customer_at');

-- عرض جدول driver_cancellations
SELECT table_name FROM information_schema.tables 
WHERE table_name = 'driver_cancellations';

-- رسالة نجاح
DO $$
BEGIN
  RAISE NOTICE '✅ تم تطبيق جميع التعديلات بنجاح!';
  RAISE NOTICE '✅ جدول driver_earnings جاهز';
  RAISE NOTICE '✅ أعمدة خطوات التوصيل جاهزة';
  RAISE NOTICE '✅ جدول driver_cancellations جاهز';
  RAISE NOTICE '✅ إحداثيات GPS جاهزة';
END $$;
