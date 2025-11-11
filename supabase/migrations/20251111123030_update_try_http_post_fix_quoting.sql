-- Update try_http_post: fix EXECUTE quoting and support 5-arg http_post
-- Date: 2025-11-11

BEGIN;

CREATE OR REPLACE FUNCTION public.try_http_post(p_url text, p_headers jsonb, p_body jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, net, pg_temp
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Prefer 5-arg variant in net schema: (url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer)
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
      AND (
        pg_get_function_identity_arguments(p.oid) = 'url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer'
        OR pg_get_function_identity_arguments(p.oid) = 'text, jsonb, jsonb, jsonb, integer'
      )
  ) INTO v_exists;
  IF v_exists THEN
    EXECUTE 'SELECT net.http_post($1::text, $2::jsonb, ''{}''::jsonb, $3::jsonb, 10000)'
      USING p_url, p_body, p_headers;
    RETURN;
  END IF;

  -- 5-arg variant in extensions schema (if provider installed it there)
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions'
      AND p.proname = 'http_post'
      AND (
        pg_get_function_identity_arguments(p.oid) = 'url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer'
        OR pg_get_function_identity_arguments(p.oid) = 'text, jsonb, jsonb, jsonb, integer'
      )
  ) INTO v_exists;
  IF v_exists THEN
    EXECUTE 'SELECT extensions.http_post($1::text, $2::jsonb, ''{}''::jsonb, $3::jsonb, 10000)'
      USING p_url, p_body, p_headers;
    RETURN;
  END IF;

  -- 3-arg variant in net schema: (url text, headers jsonb, body jsonb)
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
      AND pg_get_function_identity_arguments(p.oid) = 'text, jsonb, jsonb'
  ) INTO v_exists;
  IF v_exists THEN
    EXECUTE 'SELECT net.http_post($1::text, $2::jsonb, $3::jsonb)'
      USING p_url, p_headers, p_body;
    RETURN;
  END IF;

  -- 3-arg variant in extensions schema
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions'
      AND p.proname = 'http_post'
      AND pg_get_function_identity_arguments(p.oid) = 'text, jsonb, jsonb'
  ) INTO v_exists;
  IF v_exists THEN
    EXECUTE 'SELECT extensions.http_post($1::text, $2::jsonb, $3::jsonb)'
      USING p_url, p_headers, p_body;
    RETURN;
  END IF;

  -- 3-arg with body text (extensions)
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'extensions'
      AND p.proname = 'http_post'
      AND pg_get_function_identity_arguments(p.oid) = 'text, jsonb, text'
  ) INTO v_exists;
  IF v_exists THEN
    EXECUTE 'SELECT extensions.http_post($1::text, $2::jsonb, $3::text)'
      USING p_url, p_headers, p_body::text;
    RETURN;
  END IF;

  -- 3-arg with body text (net)
  SELECT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'net'
      AND p.proname = 'http_post'
      AND pg_get_function_identity_arguments(p.oid) = 'text, jsonb, text'
  ) INTO v_exists;
  IF v_exists THEN
    EXECUTE 'SELECT net.http_post($1::text, $2::jsonb, $3::text)'
      USING p_url, p_headers, p_body::text;
    RETURN;
  END IF;

  -- If none matched, do nothing silently
  RETURN;
END;
$$;

COMMIT;
