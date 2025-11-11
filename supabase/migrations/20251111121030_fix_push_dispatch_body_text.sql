-- Fix: use extensions.http_post with (text, jsonb, text) signature
-- Date: 2025-11-11

BEGIN;

-- Ensure pg_net exists in extensions schema
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  END IF;
END $$;

-- Drop trigger first to avoid dependency during function replacement
DROP TRIGGER IF EXISTS on_notifications_insert_push ON public.notifications;

-- Replace function to call extensions.http_post(url text, headers jsonb, body text)
CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions, pg_temp
AS $$
DECLARE
  rec record;
  v_title text := COALESCE(NEW.title, 'إشعار');
  v_body  text := COALESCE(NEW.body, '');
  v_data  jsonb := COALESCE(NEW.data, '{}'::jsonb);
  v_sound text;
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

    PERFORM extensions.http_post(
      'https://exp.host/--/api/v2/push/send'::text,
      jsonb_build_object('Content-Type','application/json'),
      jsonb_build_object(
        'to', rec.token,
        'title', v_title,
        'body', v_body,
        'sound', v_sound,
        'data', v_data
      )::text
    );
  END LOOP;

  RETURN NEW;
END $$;

-- Re-create trigger
CREATE TRIGGER on_notifications_insert_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_push_for_notification();

COMMIT;
