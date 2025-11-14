-- Make chat trigger compatible with content or message_text columns
-- Date: 2025-11-13

BEGIN;

-- Ensure message_text exists for legacy compatibility
ALTER TABLE IF EXISTS public.chat_messages
  ADD COLUMN IF NOT EXISTS message_text text;

-- Replace trigger function to use COALESCE(NEW.content, NEW.message_text)
DROP FUNCTION IF EXISTS public.tg_chat_message_after_insert() CASCADE;
CREATE OR REPLACE FUNCTION public.tg_chat_message_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $fn$
DECLARE
  rec record;
  v_preview text := COALESCE(left(COALESCE(NEW.content, NEW.message_text, ''), 80), '');
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

CREATE TRIGGER on_chat_message_after_insert
AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.tg_chat_message_after_insert();

COMMIT;
