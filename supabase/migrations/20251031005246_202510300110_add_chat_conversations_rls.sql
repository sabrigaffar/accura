-- Chat Conversations RLS policies for drivers
-- Note: Adjust table/schema names if different in your project

-- Ensure RLS is enabled on chat_conversations
alter table if exists public.chat_conversations enable row level security;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema='public' AND table_name='chat_conversations'
  ) THEN
    -- Policy: drivers can select their conversations
    DROP POLICY IF EXISTS "drivers_can_select_their_conversations" ON public.chat_conversations;
    CREATE POLICY "drivers_can_select_their_conversations"
    ON public.chat_conversations
    FOR SELECT
    TO authenticated
    USING (driver_id = auth.uid());

    -- Policy: drivers can insert conversations for themselves
    DROP POLICY IF EXISTS "drivers_can_insert_chat_conversations" ON public.chat_conversations;
    CREATE POLICY "drivers_can_insert_chat_conversations"
    ON public.chat_conversations
    FOR INSERT
    TO authenticated
    WITH CHECK (driver_id = auth.uid());

    -- Optional: allow update only by participants (driver)
    DROP POLICY IF EXISTS "drivers_can_update_their_conversations" ON public.chat_conversations;
    CREATE POLICY "drivers_can_update_their_conversations"
    ON public.chat_conversations
    FOR UPDATE
    TO authenticated
    USING (driver_id = auth.uid())
    WITH CHECK (driver_id = auth.uid());
  END IF;
END $$;

-- Optional: prevent deletes by default (omit delete policy)
-- If you want to allow delete by driver, uncomment below:
-- create policy if not exists "drivers_can_delete_their_conversations"
-- on public.chat_conversations
-- for delete
-- to authenticated
-- using (driver_id = auth.uid());
