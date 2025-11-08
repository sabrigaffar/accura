-- Normalize phone on handle_new_user insertion to ensure consistent UNIQUE comparison
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
BEGIN
  v_phone_raw := COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', NEW.raw_user_meta_data->>'phone_number', '');
  v_phone_norm := public.normalize_phone_eg(v_phone_raw);

  INSERT INTO public.profiles (id, user_type, full_name, phone_number)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(v_phone_norm, v_phone_raw)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    user_type = COALESCE(EXCLUDED.user_type, public.profiles.user_type),
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone_number = COALESCE(EXCLUDED.phone_number, public.profiles.phone_number);
  RETURN NEW;
END;
$$;

COMMIT;
