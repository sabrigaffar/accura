-- Update dispatch_push_for_notification to set sound per device type
-- Android: custom 'notification' sound (matches app.json plugin sound)
-- iOS: keep 'default' until a compatible .wav/.caf is added
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
  FOR rec IN
    SELECT pt.token, pt.device_type
    FROM public.push_tokens pt
    WHERE pt.user_id = NEW.user_id AND pt.is_active = true
    UNION
    SELECT dp.push_token AS token, NULL::text AS device_type
    FROM public.driver_profiles dp
    WHERE dp.id = NEW.user_id AND dp.push_enabled = true AND dp.push_token IS NOT NULL
  LOOP
    v_sound := CASE WHEN rec.device_type = 'ios' THEN 'default' ELSE 'notification' END;

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
