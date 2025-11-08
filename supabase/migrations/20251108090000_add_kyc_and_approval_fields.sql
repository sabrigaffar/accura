-- Add KYC fields and admin approval workflow for drivers and merchants
-- Date: 2025-11-08

BEGIN;

-- Driver profiles: ID image and approval state
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS id_image_url TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending','approved','rejected')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

COMMENT ON COLUMN public.driver_profiles.id_image_url IS 'KYC: رابط صورة الهوية للسائق من Supabase Storage (kyc-images)';
COMMENT ON COLUMN public.driver_profiles.approval_status IS 'حالة الموافقة من الإدارة: pending/approved/rejected';

-- Merchants: ID or commercial record and approval state
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS id_document_url TEXT,
  ADD COLUMN IF NOT EXISTS commercial_record_url TEXT,
  ADD COLUMN IF NOT EXISTS approval_status TEXT CHECK (approval_status IN ('pending','approved','rejected')) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_by uuid,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

COMMENT ON COLUMN public.merchants.id_document_url IS 'KYC: الهوية الشخصية لصاحب النشاط (kyc-images)';
COMMENT ON COLUMN public.merchants.commercial_record_url IS 'KYC: السجل التجاري (kyc-images)';
COMMENT ON COLUMN public.merchants.approval_status IS 'حالة الموافقة من الإدارة: pending/approved/rejected';

-- Create private bucket for KYC images if missing
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'kyc-images'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-images', 'kyc-images', FALSE);
  END IF;
END $$;

-- Storage policies for kyc-images
-- Allow authenticated users to upload to kyc-images (app enforces path prefix)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'kyc_images_insert_auth'
  ) THEN
    CREATE POLICY kyc_images_insert_auth ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'kyc-images');
  END IF;
END $$;

-- Allow select if admin OR object path under own folder
-- Expected paths:
--  drivers/<user_id>/<filename>
--  merchants/<owner_id>/<filename>
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'kyc_images_select_own_or_admin'
  ) THEN
    CREATE POLICY kyc_images_select_own_or_admin ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'kyc-images'
        AND (
          public.is_admin()
          OR position(('/' || auth.uid() || '/') in name) > 0 -- matches both drivers/<uid>/ and merchants/<uid>/ by path containment
        )
      );
  END IF;
END $$;

-- Allow delete own objects or admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'kyc_images_delete_own_or_admin'
  ) THEN
    CREATE POLICY kyc_images_delete_own_or_admin ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'kyc-images'
        AND (
          public.is_admin()
          OR position(('/' || auth.uid() || '/') in name) > 0
        )
      );
  END IF;
END $$;

COMMIT;
