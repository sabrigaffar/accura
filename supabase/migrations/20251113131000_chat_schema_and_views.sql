-- Chat schema (order-based), participants, views, and push notifications
-- Date: 2025-11-13

BEGIN;

-- Ensure pgcrypto for gen_random_uuid
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto') THEN
    CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;
  END IF;
END $$;

-- 1) Tables
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id uuid,
  driver_id uuid,
  merchant_id uuid,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer','merchant','driver','support')),
  unread_count integer NOT NULL DEFAULT 0,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text,
  type text NOT NULL DEFAULT 'text',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_edited boolean NOT NULL DEFAULT false,
  edited_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON public.chat_participants(user_id);

-- 2) RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Ensure required columns exist on existing installations
-- chat_conversations
ALTER TABLE public.chat_conversations
  ADD COLUMN IF NOT EXISTS last_message text,
  ADD COLUMN IF NOT EXISTS last_message_at timestamptz;

-- chat_participants
ALTER TABLE public.chat_participants
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_read_at timestamptz,
  ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();

-- chat_messages
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS type text DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_edited boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Conversations: participants can select
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_conversations' AND policyname='chat_conversations_select_participant'
  ) THEN
    CREATE POLICY chat_conversations_select_participant ON public.chat_conversations
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants cp
          WHERE cp.conversation_id = chat_conversations.id AND cp.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Chat participants: user can select own participant rows
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_participants' AND policyname='chat_participants_select_self'
  ) THEN
    CREATE POLICY chat_participants_select_self ON public.chat_participants
      FOR SELECT TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;

-- Messages: only participants can select
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_select_participant'
  ) THEN
    CREATE POLICY chat_messages_select_participant ON public.chat_messages
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id AND cp.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- Messages: only participants can insert
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_insert_participant'
  ) THEN
    CREATE POLICY chat_messages_insert_participant ON public.chat_messages
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.chat_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id AND cp.user_id = auth.uid()
        )
      );
  END IF;
END $$;

-- 3) Triggers
-- Ensure participants after creating conversation
DROP FUNCTION IF EXISTS public.tg_chat_conv_ensure_participants() CASCADE;
CREATE OR REPLACE FUNCTION public.tg_chat_conv_ensure_participants()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NEW.customer_id IS NOT NULL THEN
    INSERT INTO public.chat_participants(conversation_id, user_id, role)
    VALUES (NEW.id, NEW.customer_id, 'customer')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  IF NEW.driver_id IS NOT NULL THEN
    INSERT INTO public.chat_participants(conversation_id, user_id, role)
    VALUES (NEW.id, NEW.driver_id, 'driver')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  IF NEW.merchant_id IS NOT NULL THEN
    INSERT INTO public.chat_participants(conversation_id, user_id, role)
    VALUES (NEW.id, NEW.merchant_id, 'merchant')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS on_chat_conversation_insert_participants ON public.chat_conversations;
CREATE TRIGGER on_chat_conversation_insert_participants
AFTER INSERT ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.tg_chat_conv_ensure_participants();

-- After message insert: update last_message/at, increment unread for others, and notify
DROP FUNCTION IF EXISTS public.tg_chat_message_after_insert() CASCADE;
CREATE OR REPLACE FUNCTION public.tg_chat_message_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  rec record;
  v_preview text := COALESCE(left(COALESCE(NEW.content,''), 80), '');
  v_order_id uuid;
BEGIN
  UPDATE public.chat_conversations
  SET last_message = v_preview,
      last_message_at = now(),
      updated_at = now()
  WHERE id = NEW.conversation_id;

  SELECT order_id INTO v_order_id FROM public.chat_conversations WHERE id = NEW.conversation_id;

  UPDATE public.chat_participants
  SET unread_count = COALESCE(unread_count,0) + 1
  WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id;

  FOR rec IN
    SELECT user_id FROM public.chat_participants
    WHERE conversation_id = NEW.conversation_id AND user_id <> NEW.sender_id
  LOOP
    INSERT INTO public.notifications(user_id, title, body, type, data)
    VALUES (
      rec.user_id,
      '💬 رسالة جديدة',
      CASE WHEN v_preview = '' THEN 'لديك رسالة جديدة' ELSE v_preview END,
      'chat',
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id,
        'sender_id', NEW.sender_id,
        'order_id', v_order_id
      )
    );
  END LOOP;

  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS on_chat_message_after_insert ON public.chat_messages;
CREATE TRIGGER on_chat_message_after_insert
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_chat_message_after_insert();

-- 4) Compatibility views for existing ChatContext/chatService
-- Create views only if an object with same name is not a TABLE. If a TABLE exists, skip and rely on it.
DO $dv$
BEGIN
  -- conversations view
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='conversations' AND c.relkind='r' -- table
  ) THEN
    RAISE NOTICE 'public.conversations is a TABLE; skipping view creation';
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='conversations' AND c.relkind='v'
    ) THEN
      EXECUTE 'DROP VIEW IF EXISTS public.conversations CASCADE';
    END IF;
    EXECUTE $v$CREATE VIEW public.conversations AS
      SELECT 
        id,
        CASE 
          WHEN customer_id IS NOT NULL AND driver_id IS NOT NULL THEN 'customer_driver'
          WHEN merchant_id IS NOT NULL AND driver_id IS NOT NULL THEN 'merchant_driver'
          WHEN customer_id IS NOT NULL AND merchant_id IS NOT NULL THEN 'customer_merchant'
          ELSE 'support'
        END AS type,
        order_id,
        last_message,
        last_message_at,
        created_at,
        updated_at
      FROM public.chat_conversations$v$;
  END IF;

  -- conversation_participants view
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='conversation_participants' AND c.relkind='r'
  ) THEN
    RAISE NOTICE 'public.conversation_participants is a TABLE; skipping view creation';
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='conversation_participants' AND c.relkind='v'
    ) THEN
      EXECUTE 'DROP VIEW IF EXISTS public.conversation_participants CASCADE';
    END IF;
    EXECUTE $v$CREATE VIEW public.conversation_participants AS
      SELECT conversation_id, user_id, role, unread_count, last_read_at, joined_at FROM public.chat_participants$v$;
  END IF;

  -- messages view
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='messages' AND c.relkind='r'
  ) THEN
    RAISE NOTICE 'public.messages is a TABLE; skipping view creation';
  ELSE
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relname='messages' AND c.relkind='v'
    ) THEN
      EXECUTE 'DROP VIEW IF EXISTS public.messages CASCADE';
    END IF;
    EXECUTE $v$CREATE VIEW public.messages AS
      SELECT id, conversation_id, sender_id, content, type, metadata, is_edited, edited_at, created_at FROM public.chat_messages$v$;
  END IF;
END$dv$;

COMMIT;
