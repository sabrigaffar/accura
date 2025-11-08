-- Quote order with optional ad context; returns full breakdown and honors rule/promo engine
-- Date: 2025-11-06

BEGIN;

CREATE OR REPLACE FUNCTION public.quote_order_v3(
  p_customer_id uuid,
  p_store_id uuid,
  p_items jsonb,
  p_payment_method text,
  p_delivery_fee numeric,
  p_tax numeric DEFAULT 0,
  p_ad_id uuid DEFAULT NULL
)
RETURNS TABLE(
  subtotal numeric,
  delivery_fee numeric,
  service_fee numeric,
  tax numeric,
  discount numeric,
  total numeric,
  applied_promotion uuid,
  applied_rule uuid,
  apply_on text,
  applied_ad uuid,
  ad_message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_q RECORD;
  v_now timestamptz := now();
  v_ad RECORD;
  v_ad_discount numeric := 0;
  v_apply_on text := NULL;
  v_subtotal numeric := 0;
  v_df numeric := COALESCE(p_delivery_fee, 0);
  v_service_fee numeric := 0;
  v_best_discount numeric := 0;
  v_best_apply_on text := NULL;
  v_applied_ad uuid := NULL;
  v_product_base numeric := 0;
BEGIN
  SELECT * INTO v_q FROM public.calculate_order_quote_v2(p_customer_id, p_store_id, p_items, p_payment_method, p_delivery_fee, p_tax);
  v_subtotal := COALESCE(v_q.subtotal, 0);
  v_service_fee := COALESCE(v_q.service_fee, 0);
  v_best_discount := COALESCE(v_q.discount, 0);
  v_best_apply_on := v_q.apply_on;

  IF p_ad_id IS NOT NULL THEN
    SELECT * INTO v_ad FROM public.sponsored_ads WHERE id = p_ad_id;
    IF FOUND THEN
      IF v_ad.deleted_at IS NULL
         AND v_ad.merchant_id = p_store_id
         AND v_ad.approval_status = 'approved'
         AND v_ad.is_active = true
         AND v_ad.start_date <= v_now
         AND (v_ad.end_date IS NULL OR v_now <= v_ad.end_date)
         AND v_ad.total_spent < v_ad.budget_amount
         AND v_ad.discount_type IS NOT NULL
         AND v_ad.discount_amount IS NOT NULL
      THEN
        v_apply_on := COALESCE(v_ad.apply_on, 'subtotal');
        IF v_apply_on = 'product' AND v_ad.target_product_id IS NOT NULL THEN
          SELECT COALESCE(SUM(((elem->>'price')::numeric) * ((elem->>'quantity')::int)), 0)
          INTO v_product_base
          FROM jsonb_array_elements(p_items) AS elem
          WHERE elem->>'product_id' = v_ad.target_product_id::text;

          IF v_ad.discount_type = 'percent' THEN
            v_ad_discount := ROUND(v_product_base * (v_ad.discount_amount/100.0), 2);
          ELSE
            v_ad_discount := v_ad.discount_amount;
          END IF;
          IF v_ad_discount > v_product_base THEN v_ad_discount := v_product_base; END IF;
        ELSIF v_apply_on = 'delivery_fee' THEN
          v_ad_discount := CASE WHEN v_ad.discount_type = 'percent' THEN ROUND(v_df * (v_ad.discount_amount/100.0), 2) ELSE v_ad.discount_amount END;
          IF v_ad_discount > v_df THEN v_ad_discount := v_df; END IF;
        ELSIF v_apply_on = 'service_fee' THEN
          v_ad_discount := CASE WHEN v_ad.discount_type = 'percent' THEN ROUND(v_service_fee * (v_ad.discount_amount/100.0), 2) ELSE v_ad.discount_amount END;
          IF v_ad_discount > v_service_fee THEN v_ad_discount := v_service_fee; END IF;
        ELSE
          v_ad_discount := CASE WHEN v_ad.discount_type = 'percent' THEN ROUND(v_subtotal * (v_ad.discount_amount/100.0), 2) ELSE v_ad.discount_amount END;
          IF v_ad_discount > v_subtotal THEN v_ad_discount := v_subtotal; END IF;
        END IF;

        IF v_ad_discount > v_best_discount THEN
          v_best_discount := v_ad_discount;
          v_best_apply_on := v_apply_on;
          v_applied_ad := p_ad_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    v_subtotal,
    v_df,
    v_service_fee,
    COALESCE(p_tax,0),
    COALESCE(v_best_discount,0),
    v_subtotal + v_df + v_service_fee + COALESCE(p_tax,0) - COALESCE(v_best_discount,0),
    v_q.applied_promotion,
    v_q.applied_rule,
    v_best_apply_on,
    v_applied_ad,
    CASE WHEN v_applied_ad IS NOT NULL THEN 'ad_applied' ELSE 'no_ad' END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.quote_order_v3(uuid, uuid, jsonb, text, numeric, numeric, uuid) TO authenticated, anon;

COMMIT;
