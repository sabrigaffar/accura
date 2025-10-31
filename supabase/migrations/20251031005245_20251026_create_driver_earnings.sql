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

-- Ensure compatibility if table already exists without 'amount'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema='public' AND table_name='driver_earnings'
  ) THEN
    -- Add amount column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='amount'
    ) THEN
      ALTER TABLE driver_earnings ADD COLUMN amount DECIMAL(10,2) NOT NULL DEFAULT 0;

      -- Backfill amount from total_earning or fee breakdown if available
      IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='total_earning'
      ) THEN
        UPDATE driver_earnings SET amount = COALESCE(total_earning, 0);
      ELSIF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='base_fee'
      ) THEN
        UPDATE driver_earnings 
        SET amount = COALESCE(base_fee,0) + COALESCE(distance_fee,0) + COALESCE(tip_amount,0) + COALESCE(bonus,0);
      END IF;
    END IF;
  END IF;
END $$;

-- تعليقات
COMMENT ON TABLE driver_earnings IS 'سجل أرباح السائقين من التوصيلات';
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='amount'
  ) THEN
    COMMENT ON COLUMN driver_earnings.amount IS 'مبلغ الأرباح (رسوم التوصيل)';
  END IF;
END $$;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='earned_at'
  ) THEN
    COMMENT ON COLUMN driver_earnings.earned_at IS 'وقت تحقيق الأرباح';
  END IF;
END $$;

-- Indexes للأداء
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='earned_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver 
    ON driver_earnings(driver_id, earned_at DESC);
  ELSE
    CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver 
    ON driver_earnings(driver_id);
  END IF;
END $$;

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
