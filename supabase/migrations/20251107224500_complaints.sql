-- Migration: Complaints system (Phase 3)
-- - Table: complaints
-- - Table: complaint_attachments (link to storage objects)
-- - Storage bucket: complaint-images (private)
-- - RLS policies (owner/admin)
-- - RPC: submit_complaint (optional helper)

BEGIN;

-- Ensure is_admin() exists (idempotent recreation is safe)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles pr
    WHERE pr.id = auth.uid() AND pr.user_type = 'admin'
  );
$fn$;
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- complaints table
CREATE TABLE IF NOT EXISTS public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_role text NOT NULL CHECK (user_role IN ('customer','merchant','driver','admin')),
  target_type text CHECK (target_type IN ('order','merchant','driver','other')),
  target_id uuid,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved','closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  assigned_admin uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname='trg_complaints_set_updated_at'
  ) THEN
    CREATE TRIGGER trg_complaints_set_updated_at
      BEFORE UPDATE ON public.complaints
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;

-- Policies: select own or admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complaints' AND policyname='complaints_select_own_or_admin'
  ) THEN
    CREATE POLICY complaints_select_own_or_admin ON public.complaints
      FOR SELECT TO authenticated
      USING (created_by = auth.uid() OR public.is_admin());
  END IF;
END $$;

-- Owner can insert own complaints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complaints' AND policyname='complaints_insert_own'
  ) THEN
    CREATE POLICY complaints_insert_own ON public.complaints
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid());
  END IF;
END $$;

-- Owner can update own complaint (e.g., add details) while not closed; admins can always update
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complaints' AND policyname='complaints_update_owner_or_admin'
  ) THEN
    CREATE POLICY complaints_update_owner_or_admin ON public.complaints
      FOR UPDATE TO authenticated
      USING (created_by = auth.uid() OR public.is_admin())
      WITH CHECK (
        (created_by = auth.uid() AND status IN ('open','in_review'))
        OR public.is_admin()
      );
  END IF;
END $$;

-- Admin can delete complaints
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complaints' AND policyname='complaints_delete_admin'
  ) THEN
    CREATE POLICY complaints_delete_admin ON public.complaints
      FOR DELETE TO authenticated
      USING (public.is_admin());
  END IF;
END $$;

-- useful indexes
CREATE INDEX IF NOT EXISTS idx_complaints_created_by ON public.complaints(created_by);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON public.complaints(status);
CREATE INDEX IF NOT EXISTS idx_complaints_created_at ON public.complaints(created_at DESC);

-- complaint_attachments table: links storage objects to complaint rows
CREATE TABLE IF NOT EXISTS public.complaint_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id uuid NOT NULL REFERENCES public.complaints(id) ON DELETE CASCADE,
  object_path text NOT NULL, -- storage.objects.name
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.complaint_attachments ENABLE ROW LEVEL SECURITY;

-- Select attachments if owner of complaint or admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complaint_attachments' AND policyname='complaint_attachments_select_own_or_admin'
  ) THEN
    CREATE POLICY complaint_attachments_select_own_or_admin ON public.complaint_attachments
      FOR SELECT TO authenticated
      USING (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id AND c.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Insert attachments if owner of complaint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complaint_attachments' AND policyname='complaint_attachments_insert_owner'
  ) THEN
    CREATE POLICY complaint_attachments_insert_owner ON public.complaint_attachments
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id AND c.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Delete attachments if owner of complaint or admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='complaint_attachments' AND policyname='complaint_attachments_delete_own_or_admin'
  ) THEN
    CREATE POLICY complaint_attachments_delete_own_or_admin ON public.complaint_attachments
      FOR DELETE TO authenticated
      USING (
        public.is_admin()
        OR EXISTS (
          SELECT 1 FROM public.complaints c
          WHERE c.id = complaint_id AND c.created_by = auth.uid()
        )
      );
  END IF;
END $$;

-- Storage bucket for complaint images (private)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'complaint-images'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-images', 'complaint-images', FALSE);
  END IF;
END $$;

-- Storage policies for the bucket
-- Allow authenticated users to upload to complaint-images bucket; app ensures path format 'complaints/<complaint_id>/<filename>'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='complaint_images_insert_auth'
  ) THEN
    CREATE POLICY complaint_images_insert_auth ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'complaint-images');
  END IF;
END $$;

-- Allow read only if owner of complaint (via attachment link) or admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='complaint_images_select_own_or_admin'
  ) THEN
    CREATE POLICY complaint_images_select_own_or_admin ON storage.objects
      FOR SELECT TO authenticated
      USING (
        bucket_id = 'complaint-images'
        AND (
          public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.complaint_attachments a
            JOIN public.complaints c ON c.id = a.complaint_id
            WHERE a.object_path = name AND c.created_by = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Allow delete if admin or owner of linked complaint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='complaint_images_delete_own_or_admin'
  ) THEN
    CREATE POLICY complaint_images_delete_own_or_admin ON storage.objects
      FOR DELETE TO authenticated
      USING (
        bucket_id = 'complaint-images'
        AND (
          public.is_admin()
          OR EXISTS (
            SELECT 1 FROM public.complaint_attachments a
            JOIN public.complaints c ON c.id = a.complaint_id
            WHERE a.object_path = name AND c.created_by = auth.uid()
          )
        )
      );
  END IF;
END $$;

-- Optional RPC: submit complaint
CREATE OR REPLACE FUNCTION public.submit_complaint(
  p_user_role text,
  p_target_type text,
  p_target_id uuid,
  p_title text,
  p_description text,
  p_priority text DEFAULT 'medium'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'unauthorized';
  END IF;
  IF p_user_role NOT IN ('customer','merchant','driver','admin') THEN
    RAISE EXCEPTION 'invalid role';
  END IF;
  IF p_target_type IS NOT NULL AND p_target_type NOT IN ('order','merchant','driver','other') THEN
    RAISE EXCEPTION 'invalid target type';
  END IF;
  IF p_priority NOT IN ('low','medium','high') THEN
    RAISE EXCEPTION 'invalid priority';
  END IF;

  INSERT INTO public.complaints (created_by, user_role, target_type, target_id, title, description, priority)
  VALUES (v_uid, p_user_role, p_target_type, p_target_id, p_title, p_description, p_priority)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_complaint(text, text, uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_complaint(text, text, uuid, text, text, text) TO authenticated;

COMMIT;
