-- Migration: Relax complaint-images insert policy to public
BEGIN;

-- Drop previous insert policies to avoid conflicts
DROP POLICY IF EXISTS complaint_images_insert_simple ON storage.objects;
DROP POLICY IF EXISTS complaint_images_insert_auth ON storage.objects;
DROP POLICY IF EXISTS complaint_images_insert_public ON storage.objects;

-- Allow ANY role to insert into complaint-images (bucket is still private, reads are restricted)
CREATE POLICY complaint_images_insert_public ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'complaint-images');

COMMIT;
