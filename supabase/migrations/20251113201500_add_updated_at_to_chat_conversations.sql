-- Ensure updated_at exists on chat_conversations to satisfy triggers
-- Date: 2025-11-13

BEGIN;

ALTER TABLE IF EXISTS public.chat_conversations
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Ensure not null and default now() (set value for existing rows first)
UPDATE public.chat_conversations SET updated_at = COALESCE(updated_at, now());
ALTER TABLE public.chat_conversations
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

COMMIT;
