BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_merchant_subscriptions(
  p_include_inactive boolean DEFAULT true,
  p_owner_id uuid DEFAULT NULL
)
RETURNS TABLE (
  merchant_id uuid,
  merchant_name text,
  owner_id uuid,
  owner_name text,
  is_active boolean,
  monthly_fee numeric,
  status text,
  trial_end_at timestamptz,
  last_paid_at timestamptz,
  next_due_at timestamptz,
  subscription_id uuid,
  has_subscription boolean,
  phone_number text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT 
    m.id AS merchant_id,
    m.name_ar AS merchant_name,
    m.owner_id,
    p.full_name AS owner_name,
    COALESCE(m.is_active, true) AS is_active,
    COALESCE(s.monthly_fee, 100) AS monthly_fee,
    COALESCE(s.status, 'grace') AS status,
    s.trial_end_at,
    s.last_paid_at,
    s.next_due_at,
    s.id AS subscription_id,
    (s.id IS NOT NULL) AS has_subscription,
    m.phone_number AS phone_number
  FROM public.merchants m
  LEFT JOIN public.profiles p ON p.id = m.owner_id
  LEFT JOIN public.merchant_subscriptions s
    ON s.merchant_id = m.id
  WHERE (p_include_inactive = true OR COALESCE(m.is_active, true) = true)
    AND (p_owner_id IS NULL OR m.owner_id = p_owner_id);
$$;

GRANT EXECUTE ON FUNCTION public.get_admin_merchant_subscriptions(boolean, uuid) TO authenticated;

COMMIT;
