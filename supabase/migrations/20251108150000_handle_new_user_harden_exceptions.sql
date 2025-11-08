-- Harden handle_new_user: guard normalize call, catch unique violation on phone, never break signup
-- Date: 2025-11-08

BEGIN;

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
  -- Guard normalize function call in case it does not exist yet
  BEGIN
    v_phone_norm := public.normalize_phone_eg(v_phone_raw);
  EXCEPTION WHEN undefined_function THEN
    v_phone_norm := v_phone_raw;
  WHEN OTHERS THEN
    v_phone_norm := v_phone_raw;
  END;

  IF v_phone_norm IS NOT NULL AND btrim(v_phone_norm) = '' THEN
    v_phone_norm := NULL;
  END IF;

  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_user_type := COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer');

  -- Try insert, if unique violation on phone then retry with NULL phone
  BEGIN
    INSERT INTO public.profiles (id, user_type, full_name, phone_number)
    VALUES (NEW.id, v_user_type, v_full_name, v_phone_norm)
    ON CONFLICT (id) DO UPDATE
    SET
      user_type = COALESCE(EXCLUDED.user_type, public.profiles.user_type),
      full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
      phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number);
  EXCEPTION WHEN unique_violation THEN
    BEGIN
      INSERT INTO public.profiles (id, user_type, full_name, phone_number)
      VALUES (NEW.id, v_user_type, v_full_name, NULL)
      ON CONFLICT (id) DO UPDATE
      SET
        user_type = COALESCE(EXCLUDED.user_type, public.profiles.user_type),
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
    EXCEPTION WHEN OTHERS THEN
      PERFORM pg_notify('handle_new_user_error', SQLERRM);
    END;
  WHEN OTHERS THEN
    PERFORM pg_notify('handle_new_user_error', SQLERRM);
  END;

  RETURN NEW;
END;
$$;

COMMIT;
