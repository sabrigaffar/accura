-- Create push_tokens table, upsert RPC, enable pg_net, and dispatch push on notifications insert
-- Date: 2025-11-10

BEGIN;

-- 1) push_tokens table
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  device_type text,
  device_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='select_own_push_tokens'
  ) THEN
    CREATE POLICY select_own_push_tokens ON public.push_tokens FOR SELECT TO authenticated
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='insert_own_push_tokens'
  ) THEN
    CREATE POLICY insert_own_push_tokens ON public.push_tokens FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='update_own_push_tokens'
  ) THEN
    CREATE POLICY update_own_push_tokens ON public.push_tokens FOR UPDATE TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON public.push_tokens(user_id, is_active);

-- 2) RPC to upsert push token (by token uniqueness)
DROP FUNCTION IF EXISTS public.upsert_push_token(text, text, text);
CREATE OR REPLACE FUNCTION public.upsert_push_token(p_token text, p_device_type text, p_device_name text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_token IS NULL OR length(p_token) = 0 THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.push_tokens(user_id, token, device_type, device_name, is_active)
  VALUES (v_uid, p_token, p_device_type, p_device_name, true)
  ON CONFLICT (token) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    device_type = EXCLUDED.device_type,
    device_name = EXCLUDED.device_name,
    is_active = true,
    updated_at = now();

  RETURN TRUE;
END $$;

GRANT EXECUTE ON FUNCTION public.upsert_push_token(text, text, text) TO authenticated;

-- 3) Enable pg_net extension to allow HTTP requests from Postgres
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_net') THEN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
  END IF;
END $$;

-- 4) Dispatch push via Expo Push API on notifications insert
-- Drop trigger first (if exists) to avoid dependency error when dropping function
DROP TRIGGER IF EXISTS on_notifications_insert_push ON public.notifications;
DROP FUNCTION IF EXISTS public.dispatch_push_for_notification();
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
BEGIN
  -- Iterate over all active tokens for the user (generic tokens + legacy driver token)
  FOR rec IN
    SELECT token FROM public.push_tokens WHERE user_id = NEW.user_id AND is_active = true
    UNION
    SELECT push_token FROM public.driver_profiles WHERE id = NEW.user_id AND push_enabled = true AND push_token IS NOT NULL
  LOOP
    PERFORM extensions.net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object(
        'to', rec.token,
        'title', v_title,
        'body', v_body,
        'sound', 'default',
        'data', v_data
      )::text
    );
  END LOOP;

  RETURN NEW;
END $$;

CREATE TRIGGER on_notifications_insert_push
AFTER INSERT ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.dispatch_push_for_notification();

COMMIT;
