-- Ensure driver_earnings has earned_at column used by summaries and UI
BEGIN;

-- 1) Add column if missing
ALTER TABLE public.driver_earnings
  ADD COLUMN IF NOT EXISTS earned_at timestamptz;

-- 2) Backfill earned_at from created_at when null
UPDATE public.driver_earnings
SET earned_at = COALESCE(earned_at, created_at, now())
WHERE earned_at IS NULL;

-- 3) Helpful index for queries by day/week/month
CREATE INDEX IF NOT EXISTS idx_driver_earnings_driver_earned_at_desc
  ON public.driver_earnings (driver_id, earned_at DESC);

COMMIT;
