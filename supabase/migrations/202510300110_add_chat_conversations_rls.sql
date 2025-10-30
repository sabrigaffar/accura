-- Chat Conversations RLS policies for drivers
-- Note: Adjust table/schema names if different in your project

-- Ensure RLS is enabled on chat_conversations
alter table if exists public.chat_conversations enable row level security;

-- Policy: drivers can select their conversations
create policy if not exists "drivers_can_select_their_conversations"
on public.chat_conversations
for select
to authenticated
using (driver_id = auth.uid());

-- Policy: drivers can insert conversations for themselves
create policy if not exists "drivers_can_insert_chat_conversations"
on public.chat_conversations
for insert
to authenticated
with check (driver_id = auth.uid());

-- Optional: allow update only by participants (driver)
create policy if not exists "drivers_can_update_their_conversations"
on public.chat_conversations
for update
to authenticated
using (driver_id = auth.uid())
with check (driver_id = auth.uid());

-- Optional: prevent deletes by default (omit delete policy)
-- If you want to allow delete by driver, uncomment below:
-- create policy if not exists "drivers_can_delete_their_conversations"
-- on public.chat_conversations
-- for delete
-- to authenticated
-- using (driver_id = auth.uid());
