-- Add permissive UPDATE policy to enable upsert by token with WITH CHECK
BEGIN;

-- Allow authenticated users to update any token row as long as they set user_id to themselves
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_update_any_with_check'
  ) THEN
    CREATE POLICY push_tokens_update_any_with_check
      ON public.push_tokens
      AS PERMISSIVE
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Create a SECURITY DEFINER helper to upsert a push token safely
CREATE OR REPLACE FUNCTION public.upsert_push_token(
  p_token text,
  p_device_type text DEFAULT NULL,
  p_device_name text DEFAULT NULL
) RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.push_tokens (user_id, token, device_type, device_name, is_active, updated_at)
  VALUES (auth.uid(), p_token, p_device_type, p_device_name, true, now())
  ON CONFLICT (token)
  DO UPDATE SET
    user_id = auth.uid(),
    device_type = EXCLUDED.device_type,
    device_name = EXCLUDED.device_name,
    is_active = true,
    updated_at = now();
$$;

-- Ensure only authenticated can execute
REVOKE ALL ON FUNCTION public.upsert_push_token(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upsert_push_token(text, text, text) TO authenticated;

COMMIT;
