-- Add update RLS policies for chat tables so clients can mark as read
-- Date: 2025-11-14

BEGIN;

-- Allow participants to update their own participant row (e.g., set unread_count=0, last_read_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_participants' AND policyname='chat_participants_update_self'
  ) THEN
    CREATE POLICY chat_participants_update_self ON public.chat_participants
      FOR UPDATE TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END$$;

-- Allow participants to update messages (e.g., mark is_read), limited to participants of the conversation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chat_messages' AND policyname='chat_messages_update_participant'
  ) THEN
    CREATE POLICY chat_messages_update_participant ON public.chat_messages
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.chat_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id AND cp.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.chat_participants cp
          WHERE cp.conversation_id = chat_messages.conversation_id AND cp.user_id = auth.uid()
        )
      );
  END IF;
END$$;

COMMIT;
