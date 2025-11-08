-- List active promotions visible to a given user
BEGIN;

CREATE OR REPLACE FUNCTION public.list_active_promotions_for_user(p_user_id uuid)
RETURNS SETOF public.promotions
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_type text;
BEGIN
  SELECT user_type INTO v_user_type FROM public.profiles WHERE id = p_user_id;

  RETURN QUERY
  SELECT p.*
  FROM public.promotions p
  WHERE p.is_active = true
    AND p.start_at <= now()
    AND (p.end_at IS NULL OR p.end_at >= now())
    AND (
      p.audience = 'all'
      OR (p.audience = 'customer' AND (p.target_id IS NULL OR p.target_id::uuid = p_user_id))
      OR (p.audience = 'merchant' AND (p.target_id IS NULL OR p.target_id::uuid = p_user_id))
      OR (p.audience = 'driver' AND (p.target_id IS NULL OR p.target_id::uuid = p_user_id))
    );
END; $$;

GRANT EXECUTE ON FUNCTION public.list_active_promotions_for_user(uuid) TO authenticated;

COMMIT;
