-- Chat message notifications and unread count increment
-- Date: 2025-11-13

BEGIN;

-- Create helper only if messages table exists
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NULL OR to_regclass('public.chat_participants') IS NULL THEN
    RAISE NOTICE 'chat_messages/chat_participants tables not found; skipping chat notifications migration';
    RETURN;
  END IF;

  -- Function: update conversation last_message, increment unread for recipients, and insert notifications
  CREATE OR REPLACE FUNCTION public.on_message_insert_notify()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO public, pg_temp
  AS $fn$
  DECLARE
    rec record;
    v_preview text := coalesce(left(coalesce(NEW.content, ''), 80), '');
    v_order_id uuid;
  BEGIN
    -- Update conversation last_message/last_message_at if table exists
    IF to_regclass('public.conversations') IS NOT NULL THEN
      UPDATE public.conversations
      SET last_message = v_preview,
          last_message_at = now(),
          updated_at = now()
      WHERE id = NEW.conversation_id;
      SELECT order_id INTO v_order_id FROM public.conversations WHERE id = NEW.conversation_id;
    END IF;

    -- Increment unread_count for all recipients (not the sender)
    UPDATE public.conversation_participants
    SET unread_count = coalesce(unread_count, 0) + 1,
        last_read_at = last_read_at -- no change
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id;

    -- Insert notifications for all recipients (will trigger push via on_notifications_insert_push)
    FOR rec IN
      SELECT user_id FROM public.conversation_participants
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

  -- Trigger
  DROP TRIGGER IF EXISTS on_message_insert_notify ON public.chat_messages;
  CREATE TRIGGER on_message_insert_notify
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.on_message_insert_notify();
END$$;

COMMIT;
