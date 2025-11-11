-- Set default values for merchants.is_active and merchants.approval_status
-- so new stores are active and approved by default, aligning with app behavior

BEGIN;

-- Ensure approval_status column exists and set its default to 'approved'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'merchants'
      AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.merchants
      ADD COLUMN approval_status TEXT
      CHECK (approval_status IN ('pending','approved','rejected'))
      DEFAULT 'approved';
  ELSE
    ALTER TABLE public.merchants
      ALTER COLUMN approval_status SET DEFAULT 'approved';
  END IF;
END $$;

-- Ensure is_active defaults to true
ALTER TABLE public.merchants
  ALTER COLUMN is_active SET DEFAULT true;

-- Optional backfill: normalize NULLs only (do not override explicit values)
UPDATE public.merchants
SET approval_status = 'approved'
WHERE approval_status IS NULL;

UPDATE public.merchants
SET is_active = true
WHERE is_active IS NULL;

COMMIT;
