-- Ensure driver_order_offers is in supabase_realtime publication
-- Date: 2025-11-14

BEGIN;

DO $$
BEGIN
  -- Add table to publication if not already present
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_order_offers';
  EXCEPTION WHEN duplicate_object THEN
    -- already added
    NULL;
  WHEN undefined_object THEN
    -- publication not found; ignore (some environments create it later)
    NULL;
  END;
END $$;

COMMIT;
