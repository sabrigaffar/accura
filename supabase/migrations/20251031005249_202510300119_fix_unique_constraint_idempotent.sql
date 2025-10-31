-- Make adding unique constraint idempotent for driver_earnings
-- Safe to run multiple times

-- Optional: dedupe again (no-op if already clean)
DO $$
DECLARE
  v_has_earned boolean;
  v_has_updated boolean;
  v_has_created boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='earned_at'
  ) INTO v_has_earned;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='updated_at'
  ) INTO v_has_updated;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='created_at'
  ) INTO v_has_created;

  IF v_has_earned THEN
    EXECUTE '
      WITH ranked AS (
        SELECT ctid, driver_id, order_id,
               row_number() OVER (PARTITION BY driver_id, order_id ORDER BY earned_at DESC, ctid DESC) AS rn
        FROM public.driver_earnings
      )
      DELETE FROM public.driver_earnings d
      USING ranked r
      WHERE d.ctid = r.ctid AND r.rn > 1;
    ';
  ELSIF v_has_updated THEN
    EXECUTE '
      WITH ranked AS (
        SELECT ctid, driver_id, order_id,
               row_number() OVER (PARTITION BY driver_id, order_id ORDER BY updated_at DESC, ctid DESC) AS rn
        FROM public.driver_earnings
      )
      DELETE FROM public.driver_earnings d
      USING ranked r
      WHERE d.ctid = r.ctid AND r.rn > 1;
    ';
  ELSIF v_has_created THEN
    EXECUTE '
      WITH ranked AS (
        SELECT ctid, driver_id, order_id,
               row_number() OVER (PARTITION BY driver_id, order_id ORDER BY created_at DESC, ctid DESC) AS rn
        FROM public.driver_earnings
      )
      DELETE FROM public.driver_earnings d
      USING ranked r
      WHERE d.ctid = r.ctid AND r.rn > 1;
    ';
  ELSE
    EXECUTE '
      WITH ranked AS (
        SELECT ctid, driver_id, order_id,
               row_number() OVER (PARTITION BY driver_id, order_id ORDER BY ctid DESC) AS rn
        FROM public.driver_earnings
      )
      DELETE FROM public.driver_earnings d
      USING ranked r
      WHERE d.ctid = r.ctid AND r.rn > 1;
    ';
  END IF;
END $$;

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
