BEGIN;

-- 1) Ensure subscription uses 14-day trial and sets next_due_at to end of trial
CREATE OR REPLACE FUNCTION public.ensure_merchant_subscription(
  p_merchant_id uuid,
  p_monthly_fee numeric DEFAULT 100,
  p_trial_days integer DEFAULT 14
) RETURNS TABLE (created boolean, subscription_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
  v_trial_end timestamptz;
  v_next_due timestamptz;
BEGIN
  SELECT id INTO v_id FROM merchant_subscriptions WHERE merchant_id = p_merchant_id LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT false, v_id; -- already exists
    RETURN;
  END IF;

  v_trial_end := CASE WHEN p_trial_days > 0 THEN (now() + (p_trial_days || ' days')::interval) ELSE NULL END;
  v_next_due := CASE WHEN p_trial_days > 0 THEN v_trial_end ELSE now() + interval '30 days' END;

  INSERT INTO merchant_subscriptions(merchant_id, monthly_fee, status, trial_end_at, last_paid_at, next_due_at)
  VALUES (
    p_merchant_id,
    COALESCE(p_monthly_fee, 100),
    'active',
    v_trial_end,
    NULL,
    v_next_due
  ) RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id;
END;
$$;

-- Recreate trigger on merchants insert to grant 14-day trial by default
DROP TRIGGER IF EXISTS trg_merchants_ensure_subscription ON merchants;
CREATE TRIGGER trg_merchants_ensure_subscription
AFTER INSERT ON merchants
FOR EACH ROW EXECUTE FUNCTION public.tg_merchants_ensure_subscription();

-- Update implementation of trigger function to use 14 days by default
CREATE OR REPLACE FUNCTION public.tg_merchants_ensure_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM 1 FROM merchant_subscriptions WHERE merchant_id = NEW.id;
  IF NOT FOUND THEN
    PERFORM ensure_merchant_subscription(NEW.id, 100, 14);
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Notifications table + helper to send merchant notifications
CREATE TABLE IF NOT EXISTS public.merchant_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES merchants(id) ON DELETE SET NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

ALTER TABLE public.merchant_notifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchant_notifications' AND policyname='admin_select_merchant_notifications'
  ) THEN
    CREATE POLICY admin_select_merchant_notifications ON public.merchant_notifications
      FOR SELECT TO authenticated USING (is_admin());
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchant_notifications' AND policyname='admin_insert_merchant_notifications'
  ) THEN
    CREATE POLICY admin_insert_merchant_notifications ON public.merchant_notifications
      FOR INSERT TO authenticated WITH CHECK (is_admin());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.send_merchant_notification(
  p_user_id uuid,
  p_title text,
  p_body text,
  p_type text,
  p_merchant_id uuid DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.merchant_notifications(user_id, merchant_id, type, title, body)
  VALUES (p_user_id, p_merchant_id, p_type, p_title, p_body);
END;
$$;

-- 3) Processor: charge due subscriptions, auto-hide merchants on failure, send notifications
CREATE OR REPLACE FUNCTION public.process_due_subscriptions() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  rec RECORD;
  res RECORD;
BEGIN
  FOR rec IN (
    SELECT m.id AS merchant_id, m.owner_id, s.id AS sub_id, COALESCE(s.monthly_fee,100) AS fee,
           s.trial_end_at, s.next_due_at
    FROM merchants m
    JOIN merchant_subscriptions s ON s.merchant_id = m.id
    WHERE m.is_active = true
      AND (s.trial_end_at IS NULL OR s.trial_end_at <= now())
      AND s.next_due_at <= now()
  ) LOOP
    -- Try charge
    SELECT * INTO res FROM charge_merchant_subscription(rec.merchant_id, NULL);
    IF NOT COALESCE(res.ok, false) THEN
      -- Insufficient balance or other error: auto-hide
      UPDATE merchants SET is_active = false WHERE id = rec.merchant_id;
      PERFORM send_merchant_notification(rec.owner_id, 'إيقاف ظهور المتجر', 'تم إيقاف ظهور متجرك لعدم سداد الاشتراك. يرجى شحن المحفظة وإعادة المحاولة.', 'subscription', rec.merchant_id);
    ELSE
      PERFORM send_merchant_notification(rec.owner_id, 'تم تحصيل الاشتراك', 'تم تحصيل اشتراك المتجر بنجاح وتم تمديد الاشتراك شهراً جديداً.', 'subscription', rec.merchant_id);
    END IF;
  END LOOP;
END;
$$;

-- 4) When owner wallet gets credited, try to settle due subscriptions and auto-reactivate
CREATE OR REPLACE FUNCTION public.try_settle_owner_due_subscriptions(p_owner_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  rec RECORD;
  res RECORD;
BEGIN
  FOR rec IN (
    SELECT m.id AS merchant_id, m.owner_id, s.id AS sub_id
    FROM merchants m
    JOIN merchant_subscriptions s ON s.merchant_id = m.id
    WHERE m.owner_id = p_owner_id
      AND (s.trial_end_at IS NULL OR s.trial_end_at <= now())
      AND s.next_due_at <= now()
  ) LOOP
    SELECT * INTO res FROM charge_merchant_subscription(rec.merchant_id, NULL);
    IF COALESCE(res.ok, false) THEN
      UPDATE merchants SET is_active = true WHERE id = rec.merchant_id;
      PERFORM send_merchant_notification(rec.owner_id, 'تم إعادة تفعيل المتجر', 'تم سداد الاشتراك بعد شحن المحفظة وأُعيد تفعيل ظهور المتجر تلقائياً.', 'subscription', rec.merchant_id);
    END IF;
  END LOOP;
END;
$$;

-- Trigger: on wallet credit, attempt auto-settle due subscriptions for merchant owners
CREATE OR REPLACE FUNCTION public.tg_wallet_credit_settle_subscriptions() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_owner uuid;
  v_type text;
BEGIN
  SELECT owner_id, owner_type INTO v_owner, v_type FROM public.wallets WHERE id = NEW.wallet_id;
  IF v_type = 'merchant' AND NEW.type IN ('deposit','transfer_in','refund') THEN
    PERFORM try_settle_owner_due_subscriptions(v_owner);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wallet_credit_settle_subscriptions ON public.wallet_transactions;
CREATE TRIGGER trg_wallet_credit_settle_subscriptions
AFTER INSERT ON public.wallet_transactions
FOR EACH ROW EXECUTE FUNCTION public.tg_wallet_credit_settle_subscriptions();

-- Optionally, schedule periodic billing via pg_cron (if enabled)
-- SELECT cron.schedule('merchant_billing_every_30m', '*/30 * * * *', $$ SELECT public.process_due_subscriptions(); $$);

COMMIT;
