-- Indexes to speed up driver earnings queries
-- Latest earnings per driver, ordered by earned_at desc
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='earned_at'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_earned_at_desc
    ON public.driver_earnings (driver_id, earned_at DESC);
  END IF;
END $$;

-- Optional: index for aggregations per driver
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='amount'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_amount
    ON public.driver_earnings (driver_id, amount);
  END IF;
END $$;
