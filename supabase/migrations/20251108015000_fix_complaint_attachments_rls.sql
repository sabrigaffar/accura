-- Migration: Fix complaint_attachments RLS policies
-- The issue: RLS policy is blocking inserts even for valid complaint owners
-- Solution: Ensure the insert policy properly checks ownership

BEGIN;

-- Drop the existing insert policy if it exists
DROP POLICY IF EXISTS complaint_attachments_insert_owner ON public.complaint_attachments;

-- Recreate with a more explicit check
CREATE POLICY complaint_attachments_insert_owner ON public.complaint_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- The complaint must exist and be owned by the user
    EXISTS (
      SELECT 1 
      FROM public.complaints c
      WHERE c.id = complaint_id 
        AND c.created_by = auth.uid()
    )
    AND
    -- The created_by field must match the authenticated user
    created_by = auth.uid()
  );

-- Also ensure the storage policy allows uploads
-- Drop and recreate the storage insert policy
DROP POLICY IF EXISTS complaint_images_insert_auth ON storage.objects;

CREATE POLICY complaint_images_insert_auth ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-images'
    AND auth.uid() IS NOT NULL
  );

-- Add update policy for storage objects (in case of retries)
DROP POLICY IF EXISTS complaint_images_update_own ON storage.objects;

CREATE POLICY complaint_images_update_own ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'complaint-images'
    AND auth.uid() IS NOT NULL
  )
  WITH CHECK (
    bucket_id = 'complaint-images'
    AND auth.uid() IS NOT NULL
  );

COMMIT;
