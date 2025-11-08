-- Relax legacy NOT NULLs on driver_earnings and set safe defaults to avoid insert failures
BEGIN;

-- If legacy column total_earning exists, make it nullable with default 0 and backfill
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='total_earning'
  ) THEN
    ALTER TABLE public.driver_earnings ALTER COLUMN total_earning SET DEFAULT 0;
    UPDATE public.driver_earnings SET total_earning = 0 WHERE total_earning IS NULL;
    BEGIN
      ALTER TABLE public.driver_earnings ALTER COLUMN total_earning DROP NOT NULL;
    EXCEPTION WHEN others THEN
      -- ignore if already nullable
      NULL;
    END;
  END IF;
END $$;

-- If legacy columns exist and are NOT NULL, relax them similarly
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT column_name FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='driver_earnings'
      AND column_name IN ('net_amount','commission_amount','status')
  LOOP
    -- set default for numeric columns
    IF rec.column_name IN ('net_amount','commission_amount') THEN
      EXECUTE format('ALTER TABLE public.driver_earnings ALTER COLUMN %I SET DEFAULT 0', rec.column_name);
      EXECUTE format('UPDATE public.driver_earnings SET %I = 0 WHERE %I IS NULL', rec.column_name, rec.column_name);
      BEGIN
        EXECUTE format('ALTER TABLE public.driver_earnings ALTER COLUMN %I DROP NOT NULL', rec.column_name);
      EXCEPTION WHEN others THEN NULL; END;
    ELSE
      -- status: set default 'pending' and drop not null
      BEGIN
        EXECUTE 'ALTER TABLE public.driver_earnings ALTER COLUMN status SET DEFAULT ''pending''';
      EXCEPTION WHEN others THEN NULL; END;
      UPDATE public.driver_earnings SET status = COALESCE(status, 'pending');
      BEGIN
        ALTER TABLE public.driver_earnings ALTER COLUMN status DROP NOT NULL;
      EXCEPTION WHEN others THEN NULL; END;
    END IF;
  END LOOP;
END $$;

-- Ensure amount column exists with NOT NULL DEFAULT 0 (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='driver_earnings' AND column_name='amount'
  ) THEN
    ALTER TABLE public.driver_earnings ADD COLUMN amount numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

COMMIT;
