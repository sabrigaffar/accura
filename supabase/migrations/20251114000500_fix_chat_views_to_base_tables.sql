-- Fix chat views to reference base tables (no $v$ suffix) and avoid failures
-- Date: 2025-11-14

BEGIN;

-- conversations: drop if a VIEW, create VIEW if a TABLE doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='conversations' AND c.relkind='v'
  ) THEN
    EXECUTE 'DROP VIEW public.conversations CASCADE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='conversations' AND c.relkind='r'
  ) THEN
    EXECUTE 'CREATE VIEW public.conversations AS '
      || 'SELECT id, '
      || 'CASE WHEN customer_id IS NOT NULL AND driver_id IS NOT NULL THEN ''customer_driver'' '
      || 'WHEN merchant_id IS NOT NULL AND driver_id IS NOT NULL THEN ''merchant_driver'' '
      || 'WHEN customer_id IS NOT NULL AND merchant_id IS NOT NULL THEN ''customer_merchant'' '
      || 'ELSE ''support'' END AS type, '
      || 'order_id, last_message, last_message_at, created_at, updated_at '
      || 'FROM public.chat_conversations';
  END IF;
END$$;

-- conversation_participants: drop if a VIEW, create VIEW if a TABLE doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='conversation_participants' AND c.relkind='v'
  ) THEN
    EXECUTE 'DROP VIEW public.conversation_participants CASCADE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='conversation_participants' AND c.relkind='r'
  ) THEN
    EXECUTE 'CREATE VIEW public.conversation_participants AS '
      || 'SELECT conversation_id, user_id, role, unread_count, last_read_at, joined_at '
      || 'FROM public.chat_participants';
  END IF;
END$$;

-- messages: drop if a VIEW, create VIEW if a TABLE doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='messages' AND c.relkind='v'
  ) THEN
    EXECUTE 'DROP VIEW public.messages CASCADE';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='messages' AND c.relkind='r'
  ) THEN
    EXECUTE 'CREATE VIEW public.messages AS '
      || 'SELECT id, conversation_id, sender_id, content, type, metadata, is_edited, edited_at, created_at '
      || 'FROM public.chat_messages';
  END IF;
END$$;

COMMIT;
