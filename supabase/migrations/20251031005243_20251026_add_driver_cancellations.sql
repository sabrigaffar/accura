-- جدول لتتبع إلغاءات السائق
-- Migration: Add driver cancellations tracking

-- إنشاء جدول الإلغاءات
CREATE TABLE IF NOT EXISTS driver_cancellations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  cancelled_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

-- تعليقات
COMMENT ON TABLE driver_cancellations IS 'سجل إلغاءات الطلبات من طرف السائقين';
COMMENT ON COLUMN driver_cancellations.reason IS 'سبب إلغاء الطلب';

-- Index للأداء
CREATE INDEX IF NOT EXISTS idx_driver_cancellations_driver 
ON driver_cancellations(driver_id, cancelled_at DESC);

CREATE INDEX IF NOT EXISTS idx_driver_cancellations_order 
ON driver_cancellations(order_id);

-- RLS Policies
ALTER TABLE driver_cancellations ENABLE ROW LEVEL SECURITY;

-- السائق يمكنه رؤية إلغاءاته فقط
CREATE POLICY "Drivers can view their own cancellations"
ON driver_cancellations FOR SELECT
TO authenticated
USING (driver_id = auth.uid());

-- السائق يمكنه إضافة إلغاء جديد
CREATE POLICY "Drivers can insert cancellations"
ON driver_cancellations FOR INSERT
TO authenticated
WITH CHECK (driver_id = auth.uid());
