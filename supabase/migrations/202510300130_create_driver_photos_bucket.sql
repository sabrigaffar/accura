-- Create storage bucket for driver photos (if not exists) and secure policies
-- This bucket will be public-read, authenticated write to own folder, no deletes

-- Create bucket (idempotent) using insert to avoid function signature differences
insert into storage.buckets (id, name, public, file_size_limit)
values ('driver-photos', 'driver-photos', true, 10485760)
on conflict (id) do nothing;

-- Ensure RLS is enabled on storage.objects
alter table if exists storage.objects enable row level security;

-- Public read access to objects in this bucket (conditional create)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'driver_photos_public_read'
  ) then
    create policy "driver_photos_public_read"
    on storage.objects
    for select
    to public
    using (bucket_id = 'driver-photos');
  end if;
end$$;

-- Authenticated users can upload to their own folder only: {auth.uid()}/... (conditional create)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'driver_photos_auth_insert_own_folder'
  ) then
    create policy "driver_photos_auth_insert_own_folder"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'driver-photos'
      and (name like auth.uid()::text || '/%')
    );
  end if;
end$$;

-- Authenticated users can update (overwrite) files in their own folder only (conditional create)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'driver_photos_auth_update_own_folder'
  ) then
    create policy "driver_photos_auth_update_own_folder"
    on storage.objects
    for update
    to authenticated
    using (
      bucket_id = 'driver-photos'
      and (name like auth.uid()::text || '/%')
    )
    with check (
      bucket_id = 'driver-photos'
      and (name like auth.uid()::text || '/%')
    );
  end if;
end$$;

-- Do NOT add a delete policy to effectively prevent deletions by default
-- If delete should be allowed in the future, add a policy similarly scoped to own folder.
