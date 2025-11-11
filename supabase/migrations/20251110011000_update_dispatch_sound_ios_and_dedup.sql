-- Update dispatch_push_for_notification: use custom iOS wav sound and avoid duplicate sends when token exists in both tables
-- Date: 2025-11-10

BEGIN;

CREATE OR REPLACE FUNCTION public.dispatch_push_for_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  rec record;
  v_title text := COALESCE(NEW.title, 'إشعار');
  v_body  text := COALESCE(NEW.body, '');
  v_data  jsonb := COALESCE(NEW.data, '{}'::jsonb);
  v_sound text;
BEGIN
  -- Prefer tokens from push_tokens; include driver_profiles token only if not already present
  FOR rec IN
    (
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
    )
  LOOP
    -- iOS uses the bundled file name (with extension), Android relies on channel sound ('notification')
    v_sound := CASE
      WHEN rec.device_type = 'ios' THEN 'notification.wav'
      WHEN rec.device_type = 'android' THEN 'notification'
      ELSE 'notification.wav' -- fallback: better for iOS; Android ignores payload sound when channel is set
    END;

    PERFORM extensions.net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object(
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

COMMIT;
