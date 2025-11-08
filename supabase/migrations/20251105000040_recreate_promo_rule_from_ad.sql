-- Recreate a promotion rule from an existing ad so discount applies again
-- The rule will be rebuilt based on the ad's stored offer fields and re-linked to the ad

BEGIN;

CREATE OR REPLACE FUNCTION recreate_promotion_rule_for_ad(p_ad_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule_id uuid;
  v_ad RECORD;
BEGIN
  -- Load ad with required offer fields
  SELECT id, merchant_id, title, start_date, end_date,
         discount_type, discount_amount, apply_on, target_product_id
  INTO v_ad
  FROM sponsored_ads
  WHERE id = p_ad_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'الإعلان غير موجود');
  END IF;

  IF v_ad.discount_type IS NULL OR v_ad.discount_amount IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'الإعلان لا يحتوي بيانات عرض');
  END IF;

  -- Create a new promotion rule from the ad's fields
  INSERT INTO promotion_rules(
    name,
    is_active,
    start_at,
    end_at,
    audience,
    store_id,
    discount_type,
    discount_amount,
    apply_on,
    priority,
    target_product_id
  ) VALUES (
    CONCAT('عرض إعلان: ', COALESCE(v_ad.title, 'إعلان')),
    true,
    v_ad.start_date,
    v_ad.end_date,
    'all',
    v_ad.merchant_id,
    -- handle enum casts whether ad columns are text or enum
    (v_ad.discount_type::text)::discount_type_enum,
    v_ad.discount_amount,
    COALESCE((v_ad.apply_on::text), 'subtotal')::promo_apply_on_enum,
    100,
    v_ad.target_product_id
  ) RETURNING id INTO v_rule_id;

  -- Link the ad back to the new rule
  UPDATE sponsored_ads SET promotion_rule_id = v_rule_id WHERE id = p_ad_id;

  RETURN json_build_object('success', true, 'promotion_rule_id', v_rule_id);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION recreate_promotion_rule_for_ad(uuid) TO authenticated;

COMMIT;
