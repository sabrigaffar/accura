-- إنشاء جدول أرباح السائقين
-- Migration: Create driver_earnings table

-- إنشاء الجدول
CREATE TABLE IF NOT EXISTS driver_earnings (
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

-- Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver 
ON driver_earnings(driver_id, earned_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_earnings_order 
ON driver_earnings(order_id);

-- RLS Policies
ALTER TABLE driver_earnings ENABLE ROW LEVEL SECURITY;

-- السائق يمكنه رؤية أرباحه فقط
CREATE POLICY "Drivers can view their own earnings"
ON driver_earnings FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

-- السائق يمكنه إضافة أرباح جديدة
CREATE POLICY "Drivers can insert earnings"
ON driver_earnings FOR INSERT
TO authenticated
WITH CHECK (driver_id = auth.uid());

-- السماح للنظام بإدراج الأرباح
CREATE POLICY "System can insert earnings"
ON driver_earnings FOR INSERT
TO authenticated
WITH CHECK (true);
