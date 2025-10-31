-- Create storage bucket for driver photos (if not exists) and secure policies
-- This bucket will be public-read, authenticated write to own folder, no deletes

-- Create bucket (idempotent) using insert to avoid function signature differences
insert into storage.buckets (id, name, public, file_size_limit)
values ('driver-photos', 'driver-photos', true, 10485760)
on conflict (id) do nothing;

-- Ensure RLS is enabled on storage.objects (best-effort; skip if not owner)
DO $$
BEGIN
  BEGIN
    EXECUTE 'alter table storage.objects enable row level security';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping enabling RLS on storage.objects (insufficient privilege)';
  WHEN undefined_table THEN
    RAISE NOTICE 'storage.objects not found, skipping';
  END;
END $$;

-- Public read access to objects in this bucket (conditional create)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'driver_photos_public_read'
  ) THEN
    BEGIN
      CREATE POLICY "driver_photos_public_read"
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'driver-photos');
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping policy driver_photos_public_read (insufficient privilege)';
    END;
  END IF;
END$$;

-- Authenticated users can upload to their own folder only: {auth.uid()}/... (conditional create)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'driver_photos_auth_insert_own_folder'
  ) THEN
    BEGIN
      CREATE POLICY "driver_photos_auth_insert_own_folder"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'driver-photos'
        AND (name LIKE auth.uid()::text || '/%')
      );
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping policy driver_photos_auth_insert_own_folder (insufficient privilege)';
    END;
  END IF;
END$$;

-- Authenticated users can update (overwrite) files in their own folder only (conditional create)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'driver_photos_auth_update_own_folder'
  ) THEN
    BEGIN
      CREATE POLICY "driver_photos_auth_update_own_folder"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'driver-photos'
        AND (name LIKE auth.uid()::text || '/%')
      )
      WITH CHECK (
        bucket_id = 'driver-photos'
        AND (name LIKE auth.uid()::text || '/%')
      );
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping policy driver_photos_auth_update_own_folder (insufficient privilege)';
    END;
  END IF;
END$$;

-- Do NOT add a delete policy to effectively prevent deletions by default
-- If delete should be allowed in the future, add a policy similarly scoped to own folder.
