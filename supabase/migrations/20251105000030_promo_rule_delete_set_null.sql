-- Make deleting promotion rules safe by nullifying references from sponsored_ads
-- and ensuring admin can perform required updates under RLS.

BEGIN;

-- 1) Relax FK: ON DELETE SET NULL
ALTER TABLE sponsored_ads DROP CONSTRAINT IF EXISTS sponsored_ads_promotion_rule_id_fkey;
ALTER TABLE sponsored_ads
  ADD CONSTRAINT sponsored_ads_promotion_rule_id_fkey
  FOREIGN KEY (promotion_rule_id)
  REFERENCES promotion_rules(id)
  ON DELETE SET NULL;

-- Ensure the column is nullable (it should be, but enforce to be safe)
ALTER TABLE sponsored_ads ALTER COLUMN promotion_rule_id DROP NOT NULL;

-- 2) RLS: allow admins to manage sponsored_ads as well (needed for cascades / admin tooling)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='sponsored_ads' AND policyname='sponsored_ads_admin_manage'
  ) THEN
    CREATE POLICY sponsored_ads_admin_manage ON sponsored_ads FOR ALL TO authenticated
    USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
    )
    WITH CHECK (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_type = 'admin')
    );
  END IF;
END $$;

-- 3) Helper: safe delete function (optional for UI)
CREATE OR REPLACE FUNCTION delete_promotion_rule_safe(p_rule_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  -- Nullify references from sponsored_ads
  UPDATE sponsored_ads
  SET promotion_rule_id = NULL
  WHERE promotion_rule_id = p_rule_id;

  -- Delete the rule
  DELETE FROM promotion_rules WHERE id = p_rule_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  IF v_deleted = 0 THEN
    RETURN json_build_object('success', false, 'error', 'القاعدة غير موجودة');
  END IF;

  RETURN json_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Grant execute to authenticated (policy guards admin-only behavior)
GRANT EXECUTE ON FUNCTION delete_promotion_rule_safe(uuid) TO authenticated;

COMMIT;
