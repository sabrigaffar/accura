-- Add net_amount and commission_amount to driver_earnings and backfill

ALTER TABLE driver_earnings
  ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC DEFAULT 0;

-- Backfill net_amount where possible: if commission_amount present, else assume 0
DO $$
BEGIN
  -- If legacy 'amount' column exists, use it
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'driver_earnings' AND column_name = 'amount'
  ) THEN
    UPDATE driver_earnings
    SET net_amount = COALESCE(amount - COALESCE(commission_amount,0), amount)
    WHERE net_amount IS NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'driver_earnings' AND column_name = 'total_earning'
  ) THEN
    -- If new schema uses total_earning, use it
    UPDATE driver_earnings
    SET net_amount = COALESCE(total_earning - COALESCE(commission_amount,0), total_earning)
    WHERE net_amount IS NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'driver_earnings' AND column_name = 'base_fee'
  ) THEN
    -- If breakdown columns exist, sum them
    UPDATE driver_earnings
    SET net_amount = COALESCE(
      (COALESCE(base_fee,0) + COALESCE(distance_fee,0) + COALESCE(tip_amount,0) + COALESCE(bonus,0)) - COALESCE(commission_amount,0),
      (COALESCE(base_fee,0) + COALESCE(distance_fee,0) + COALESCE(tip_amount,0) + COALESCE(bonus,0))
    )
    WHERE net_amount IS NULL;
  ELSE
    -- Fallback: set net_amount = 0 if we cannot detect a source
    UPDATE driver_earnings
    SET net_amount = 0
    WHERE net_amount IS NULL;
  END IF;
END $$;

-- Optional unique index safety (if not already created elsewhere)
-- CREATE UNIQUE INDEX IF NOT EXISTS ux_driver_earnings_order ON driver_earnings(order_id);
