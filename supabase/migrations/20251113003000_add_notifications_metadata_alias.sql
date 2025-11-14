-- Add compatibility alias column `metadata` on notifications and keep it in sync with `data`
-- Date: 2025-11-13

BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Keep data/metadata in sync on INSERT/UPDATE
DROP FUNCTION IF EXISTS public.tg_notifications_sync_metadata_data() CASCADE;
CREATE OR REPLACE FUNCTION public.tg_notifications_sync_metadata_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If only metadata provided, copy into data
  IF (NEW.data IS NULL OR NEW.data = '{}'::jsonb) AND NEW.metadata IS NOT NULL THEN
    NEW.data := NEW.metadata;
  END IF;
  -- If only data provided, mirror into metadata
  IF (NEW.metadata IS NULL OR NEW.metadata = '{}'::jsonb) AND NEW.data IS NOT NULL THEN
    NEW.metadata := NEW.data;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_sync_metadata_data ON public.notifications;
CREATE TRIGGER notifications_sync_metadata_data
BEFORE INSERT OR UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.tg_notifications_sync_metadata_data();

COMMIT;
