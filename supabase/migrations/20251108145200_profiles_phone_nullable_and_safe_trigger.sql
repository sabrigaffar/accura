-- Make profiles.phone_number nullable and harden handle_new_user to avoid failing signups
-- Date: 2025-11-08

BEGIN;

-- 1) Allow NULL phone_number to prevent NOT NULL violations during signup
ALTER TABLE public.profiles ALTER COLUMN phone_number DROP NOT NULL;

-- 2) Update trigger function: normalize phone, treat empty as NULL, and never raise errors
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
SET row_security = off
AS $$
DECLARE
  v_phone_raw text;
  v_phone_norm text;
  v_full_name text;
  v_user_type text;
BEGIN
  v_phone_raw := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone_number', NULL);
  v_phone_norm := public.normalize_phone_eg(v_phone_raw);
  IF v_phone_norm IS NOT NULL AND btrim(v_phone_norm) = '' THEN
    v_phone_norm := NULL;
  END IF;
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer');

  BEGIN
    INSERT INTO public.profiles (id, user_type, full_name, phone_number)
    VALUES (
      NEW.id,
      v_user_type,
      v_full_name,
      v_phone_norm
    )
    ON CONFLICT (id) DO UPDATE
    SET
      user_type = COALESCE(EXCLUDED.user_type, public.profiles.user_type),
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number);
  EXCEPTION WHEN OTHERS THEN
    -- Do not fail signup due to profile insert issues. Optionally log the error.
    PERFORM pg_notify('handle_new_user_error', SQLERRM);
  END;

  RETURN NEW;
END;
$$;

COMMIT;
