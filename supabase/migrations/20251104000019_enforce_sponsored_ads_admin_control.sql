-- Enforce that only admin can change approval_status/is_active and active requires approved
BEGIN;

-- Constraint: cannot be active unless approved
ALTER TABLE sponsored_ads DROP CONSTRAINT IF EXISTS chk_active_requires_approved;
ALTER TABLE sponsored_ads ADD CONSTRAINT chk_active_requires_approved CHECK (
  NOT is_active OR approval_status = 'approved'
);

-- Trigger function to block non-admin from status/activation changes
CREATE OR REPLACE FUNCTION enforce_admin_for_ad_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW.approval_status IS DISTINCT FROM OLD.approval_status)
       OR (NEW.is_active IS DISTINCT FROM OLD.is_active) THEN
      IF NOT is_admin() THEN
        RAISE EXCEPTION 'Only admin can change approval status or activation of an ad';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_for_ad_status ON sponsored_ads;
CREATE TRIGGER trg_enforce_admin_for_ad_status
BEFORE UPDATE ON sponsored_ads
FOR EACH ROW
EXECUTE FUNCTION enforce_admin_for_ad_status();

-- RLS: ensure admins can update/delete; merchants can update their own ads except status/activation (enforced by trigger)
ALTER TABLE sponsored_ads ENABLE ROW LEVEL SECURITY;

-- Admin update/delete
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='admin_update_sponsored_ads') THEN
    DROP POLICY admin_update_sponsored_ads ON sponsored_ads;
  END IF;
  CREATE POLICY admin_update_sponsored_ads ON sponsored_ads FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='admin_delete_sponsored_ads') THEN
    DROP POLICY admin_delete_sponsored_ads ON sponsored_ads;
  END IF;
  CREATE POLICY admin_delete_sponsored_ads ON sponsored_ads FOR DELETE TO authenticated USING (is_admin());
END $$;

-- Merchant can select and update own ads (non-status fields; trigger will block status changes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='merchant_select_own_ads') THEN
    CREATE POLICY merchant_select_own_ads ON sponsored_ads FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM merchants m WHERE m.id = sponsored_ads.merchant_id AND m.owner_id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='merchant_update_own_ads_restricted') THEN
    CREATE POLICY merchant_update_own_ads_restricted ON sponsored_ads FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM merchants m WHERE m.id = sponsored_ads.merchant_id AND m.owner_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM merchants m WHERE m.id = sponsored_ads.merchant_id AND m.owner_id = auth.uid()));
  END IF;
END $$;

COMMIT;
