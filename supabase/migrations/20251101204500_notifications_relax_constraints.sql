-- Relax NOT NULL constraints on legacy language-specific columns and normalize on insert
BEGIN;

-- Drop NOT NULL on legacy columns to allow unified 'title'/'body' inserts
ALTER TABLE public.notifications ALTER COLUMN title_ar DROP NOT NULL;
ALTER TABLE public.notifications ALTER COLUMN body_ar DROP NOT NULL;

-- Create a trigger to fill legacy columns from unified columns when missing
CREATE OR REPLACE FUNCTION public.normalize_notifications_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Mirror unified fields into legacy columns if NULL
  IF NEW.title_ar IS NULL THEN
    NEW.title_ar := COALESCE(NEW.title, '');
  END IF;
  IF NEW.body_ar IS NULL THEN
    NEW.body_ar := COALESCE(NEW.body, '');
  END IF;
  IF NEW.title_en IS NULL AND NEW.title IS NOT NULL THEN
    NEW.title_en := NEW.title;
  END IF;
  IF NEW.body_en IS NULL AND NEW.body IS NOT NULL THEN
    NEW.body_en := NEW.body;
  END IF;
  IF NEW.notification_type IS NULL AND NEW.type IS NOT NULL THEN
    NEW.notification_type := NEW.type;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_notifications_defaults ON public.notifications;
CREATE TRIGGER trg_normalize_notifications_defaults
BEFORE INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.normalize_notifications_defaults();

COMMIT;
