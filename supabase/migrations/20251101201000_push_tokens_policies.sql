-- Ensure push_tokens table exists and allow authenticated users to upsert their own tokens
BEGIN;

-- Enable pgcrypto for gen_random_uuid if needed
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create table if not exists
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  device_type text,
  device_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint on token to support onConflict: 'token'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'push_tokens_token_key'
  ) THEN
    ALTER TABLE public.push_tokens
    ADD CONSTRAINT push_tokens_token_key UNIQUE (token);
  END IF;
END $$;

-- Helpful index by user
CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON public.push_tokens(user_id);

-- RLS
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own token
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_insert_own'
  ) THEN
    CREATE POLICY push_tokens_insert_own
      ON public.push_tokens
      AS PERMISSIVE
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
  END IF;
END $$;

-- Allow users to update their own token (for upsert update path)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_update_own'
  ) THEN
    CREATE POLICY push_tokens_update_own
      ON public.push_tokens
      AS PERMISSIVE
      FOR UPDATE
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- (Optional) allow users to see their own tokens
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='push_tokens' AND policyname='push_tokens_select_own'
  ) THEN
    CREATE POLICY push_tokens_select_own
      ON public.push_tokens
      AS PERMISSIVE
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

COMMIT;
