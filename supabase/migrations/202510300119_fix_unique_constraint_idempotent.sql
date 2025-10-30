-- Make adding unique constraint idempotent for driver_earnings
-- Safe to run multiple times

-- Optional: dedupe again (no-op if already clean)
with ranked as (
  select ctid, driver_id, order_id,
         row_number() over (partition by driver_id, order_id order by earned_at desc, ctid desc) as rn
  from public.driver_earnings
)
delete from public.driver_earnings d
using ranked r
where d.ctid = r.ctid and r.rn > 1;

-- Conditionally add the unique constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uq_driver_earnings_driver_order'
      AND conrelid = 'public.driver_earnings'::regclass
  ) THEN
    ALTER TABLE public.driver_earnings
    ADD CONSTRAINT uq_driver_earnings_driver_order UNIQUE (driver_id, order_id);
  END IF;
END
$$;
