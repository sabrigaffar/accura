-- Dynamic resolution for http_post: try multiple schemas/signatures using EXECUTE
-- Date: 2025-11-11

BEGIN;

-- Ensure pg_net exists; if provider places it under a specific schema, this just ensures availability
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net;
  END IF;
END $$;

-- Helper function to call whichever http_post variant exists
DROP FUNCTION IF EXISTS public.try_http_post(text, jsonb, jsonb);
CREATE OR REPLACE FUNCTION public.try_http_post(p_url text, p_headers jsonb, p_body jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, net, pg_temp
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Prefer extensions.http_post(text, jsonb, jsonb)
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

  -- Try net.http_post(text, jsonb, jsonb)
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

  -- Try extensions.http_post(text, jsonb, text)
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

  -- Try net.http_post(text, jsonb, text)
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

  -- If none exists, do nothing (avoid blocking business logic)
  RETURN;
END $$;

-- Drop trigger first to avoid dependency while replacing main function
DROP TRIGGER IF EXISTS on_notifications_insert_push ON public.notifications;

-- Replace main dispatch function to use try_http_post
CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, net, pg_temp
AS $$
DECLARE
  rec record;
  v_title text := COALESCE(NEW.title, 'إشعار');
  v_body  text := COALESCE(NEW.body, '');
  v_data  jsonb := COALESCE(NEW.data, '{}'::jsonb);
  v_sound text;
  v_headers jsonb := jsonb_build_object('Content-Type','application/json');
  v_url text := 'https://exp.host/--/api/v2/push/send';
  v_payload jsonb;
BEGIN
  FOR rec IN (
    SELECT pt.token, pt.device_type
    FROM public.push_tokens pt
    WHERE pt.user_id = NEW.user_id AND pt.is_active = true
    UNION
    SELECT dp.push_token AS token, NULL::text AS device_type
    FROM public.driver_profiles dp
    WHERE dp.id = NEW.user_id AND dp.push_enabled = true AND dp.push_token IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.push_tokens pt2 WHERE pt2.token = dp.push_token AND pt2.is_active = true
      )
  ) LOOP
    v_sound := CASE
      WHEN rec.device_type = 'ios' THEN 'notification.wav'
      WHEN rec.device_type = 'android' THEN 'notification'
      ELSE 'notification.wav'
    END;

    v_payload := jsonb_build_object(
      'to', rec.token,
      'title', v_title,
      'body', v_body,
      'sound', v_sound,
      'data', v_data
    );

    PERFORM public.try_http_post(v_url, v_headers, v_payload);
  END LOOP;

  RETURN NEW;
END $$;

-- Recreate trigger after function replacement
CREATE TRIGGER on_notifications_insert_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_push_for_notification();

COMMIT;
