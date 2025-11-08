BEGIN;

-- Function: ensure_merchant_subscription
CREATE OR REPLACE FUNCTION public.ensure_merchant_subscription(
  p_merchant_id uuid,
  p_monthly_fee numeric DEFAULT 100,
  p_trial_days integer DEFAULT 0
) RETURNS TABLE (created boolean, subscription_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM merchant_subscriptions WHERE merchant_id = p_merchant_id LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT false, v_id; -- already exists
    RETURN;
  END IF;

  INSERT INTO merchant_subscriptions(merchant_id, monthly_fee, status, trial_end_at, last_paid_at, next_due_at)
  VALUES (
    p_merchant_id,
    COALESCE(p_monthly_fee, 100),
    CASE WHEN p_trial_days > 0 THEN 'active' ELSE 'active' END,
    CASE WHEN p_trial_days > 0 THEN (now() + (p_trial_days || ' days')::interval) ELSE NULL END,
    NULL,
    now() + interval '30 days'
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_merchant_subscription(uuid, numeric, integer) TO authenticated;

-- Backfill: create subscriptions for all merchants missing one
INSERT INTO merchant_subscriptions (merchant_id, monthly_fee, status, trial_end_at, last_paid_at, next_due_at)
SELECT m.id, 100, 'active', NULL, NULL, now() + interval '30 days'
FROM merchants m
LEFT JOIN merchant_subscriptions s ON s.merchant_id = m.id
WHERE s.id IS NULL;

-- Trigger: on merchants insert, ensure subscription exists (100 EGP by default)
CREATE OR REPLACE FUNCTION public.tg_merchants_ensure_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM 1 FROM merchant_subscriptions WHERE merchant_id = NEW.id;
  IF NOT FOUND THEN
    PERFORM ensure_merchant_subscription(NEW.id, 100, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchants_ensure_subscription ON merchants;
CREATE TRIGGER trg_merchants_ensure_subscription
AFTER INSERT ON merchants
FOR EACH ROW EXECUTE FUNCTION public.tg_merchants_ensure_subscription();

-- Trigger: when merchant is re-activated, ensure subscription exists
CREATE OR REPLACE FUNCTION public.tg_merchants_activate_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.is_active = true AND (OLD.is_active IS DISTINCT FROM NEW.is_active) THEN
    PERFORM ensure_merchant_subscription(NEW.id, 100, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchants_activate_subscription ON merchants;
CREATE TRIGGER trg_merchants_activate_subscription
AFTER UPDATE OF is_active ON merchants
FOR EACH ROW EXECUTE FUNCTION public.tg_merchants_activate_subscription();

COMMIT;
