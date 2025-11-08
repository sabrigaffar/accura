-- Migration: Phone login support (Egypt normalization + phone->email RPC)
-- - Adds immutable normalize_phone_eg(text)
-- - Adds SECURITY DEFINER resolve_email_by_phone(p_phone text) returning email
-- - Adds non-unique index on normalized phone for faster lookups

BEGIN;

-- 1) Normalization function for Egyptian numbers to E.164 (+20)
CREATE OR REPLACE FUNCTION public.normalize_phone_eg(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  p text;
BEGIN
  IF p_phone IS NULL THEN
    RETURN NULL;
  END IF;
  p := regexp_replace(trim(p_phone), '\\s+', '', 'g');
  IF p = '' THEN
    RETURN NULL;
  END IF;
  -- 0020 -> +20
  IF position('0020' IN p) = 1 THEN
    p := '+' || substring(p from 3);
  END IF;
  -- 020xxxx -> +20xxxx
  IF left(p, 2) = '20' AND left(p, 1) <> '+' THEN
    p := '+' || p;
  END IF;
  -- 01xxxxxxxxx -> +201xxxxxxxx
  IF left(p, 1) <> '+' AND p ~ '^01[0-9]{9}$' THEN
    p := '+20' || substring(p from 2);
  END IF;
  -- If still plain digits length 10..15, prepend +
  IF left(p, 1) <> '+' AND p ~ '^[0-9]{10,15}$' THEN
    p := '+' || p;
  END IF;
  RETURN p;
END;
$$;

COMMENT ON FUNCTION public.normalize_phone_eg(text) IS 'Normalize Egyptian phone numbers to E.164 (+20). Pure/immutable.';

-- 2) Non-unique functional index for faster lookups by normalized phone
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_profiles_phone_e164'
  ) THEN
    EXECUTE 'CREATE INDEX idx_profiles_phone_e164 ON public.profiles ((public.normalize_phone_eg(phone_number))) WHERE phone_number IS NOT NULL';
  END IF;
END $$;

-- 3) RPC: resolve email by phone (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.resolve_email_by_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_norm text;
  v_uid uuid;
  v_email text;
BEGIN
  IF p_phone IS NULL OR btrim(p_phone) = '' THEN
    RETURN NULL;
  END IF;
  v_norm := public.normalize_phone_eg(p_phone);

  -- Find profile id by normalized phone
  SELECT p.id INTO v_uid
  FROM public.profiles p
  WHERE public.normalize_phone_eg(p.phone_number) = v_norm
  LIMIT 1;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- Read email from auth.users by id
  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  RETURN v_email;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_email_by_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_email_by_phone(text) TO anon, authenticated;

COMMIT;
