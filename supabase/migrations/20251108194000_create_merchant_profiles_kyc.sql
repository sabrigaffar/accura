-- Create merchant_profiles table to hold merchant KYC at registration
-- and an admin RPC to approve/reject these profiles.
-- Date: 2025-11-08

BEGIN;

-- 1) Table
CREATE TABLE IF NOT EXISTS public.merchant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  id_document_url text,
  commercial_record_url text,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending','approved','rejected')),
  approved_by uuid REFERENCES public.profiles(id),
  approved_at timestamptz,
  rejected_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_profiles ENABLE ROW LEVEL SECURITY;

-- 2) Policies
-- Owner can select own merchant_profile
DROP POLICY IF EXISTS merchant_profiles_owner_select ON public.merchant_profiles;
CREATE POLICY merchant_profiles_owner_select
  ON public.merchant_profiles FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Owner can insert their own merchant_profile (single row per owner)
DROP POLICY IF EXISTS merchant_profiles_owner_insert ON public.merchant_profiles;
CREATE POLICY merchant_profiles_owner_insert
  ON public.merchant_profiles FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Owner can update own merchant_profile only for uploading docs while pending
DROP POLICY IF EXISTS merchant_profiles_owner_update_docs ON public.merchant_profiles;
CREATE POLICY merchant_profiles_owner_update_docs
  ON public.merchant_profiles FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() AND approval_status = 'pending')
  WITH CHECK (
    owner_id = auth.uid() AND approval_status = 'pending'
  );

-- Admins: full select
DROP POLICY IF EXISTS merchant_profiles_admin_select ON public.merchant_profiles;
CREATE POLICY merchant_profiles_admin_select
  ON public.merchant_profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admins: update approval fields
DROP POLICY IF EXISTS merchant_profiles_admin_update ON public.merchant_profiles;
CREATE POLICY merchant_profiles_admin_update
  ON public.merchant_profiles FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3) Trigger to maintain updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_merchant_profiles_updated_at ON public.merchant_profiles;
CREATE TRIGGER trg_merchant_profiles_updated_at
BEFORE UPDATE ON public.merchant_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Admin RPC to approve/reject merchant_profile
CREATE OR REPLACE FUNCTION public.admin_update_merchant_profile_approval(
  p_owner_id uuid,
  p_action text,
  p_notes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_admin boolean;
  v_now timestamptz := now();
BEGIN
  -- ensure caller is admin
  v_admin := public.is_admin();
  IF NOT v_admin THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid action %', p_action;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.merchant_profiles
    SET approval_status = 'approved', approved_by = auth.uid(), approved_at = v_now, notes = p_notes
    WHERE owner_id = p_owner_id;
  ELSE
    UPDATE public.merchant_profiles
    SET approval_status = 'rejected', approved_by = auth.uid(), rejected_at = v_now, notes = p_notes
    WHERE owner_id = p_owner_id;
  END IF;

  -- optional: notify user
  -- PERFORM edge function or insert notification here if desired
END;$$;

REVOKE ALL ON FUNCTION public.admin_update_merchant_profile_approval(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_merchant_profile_approval(uuid, text, text) TO authenticated;

COMMIT;
