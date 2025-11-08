-- Migration: Simplify complaint storage policies
-- Remove all existing policies and create simple ones

BEGIN;

-- Remove all existing storage policies for complaint-images
DROP POLICY IF EXISTS complaint_images_insert_auth ON storage.objects;
DROP POLICY IF EXISTS complaint_images_update_own ON storage.objects;
DROP POLICY IF EXISTS complaint_images_select_own_or_admin ON storage.objects;
DROP POLICY IF EXISTS complaint_images_delete_own_or_admin ON storage.objects;

-- Create simple INSERT policy: any authenticated user can upload to complaint-images
CREATE POLICY complaint_images_insert_simple ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'complaint-images'
  );

-- Create simple SELECT policy: user can read their own complaint images or admin can read all
CREATE POLICY complaint_images_select_simple ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'complaint-images'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 
        FROM public.complaint_attachments a
        JOIN public.complaints c ON c.id = a.complaint_id
        WHERE a.object_path = name 
          AND c.created_by = auth.uid()
      )
    )
  );

-- Create simple UPDATE policy: any authenticated user can update their uploads
CREATE POLICY complaint_images_update_simple ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'complaint-images'
  )
  WITH CHECK (
    bucket_id = 'complaint-images'
  );

-- Create simple DELETE policy: user can delete their own complaint images or admin can delete all
CREATE POLICY complaint_images_delete_simple ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'complaint-images'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 
        FROM public.complaint_attachments a
        JOIN public.complaints c ON c.id = a.complaint_id
        WHERE a.object_path = name 
          AND c.created_by = auth.uid()
      )
    )
  );

COMMIT;
