-- Harden get_active_sponsored_ads: SECURITY DEFINER + locked search_path for reliability under RLS
-- Date: 2025-11-08

BEGIN;

CREATE OR REPLACE FUNCTION public.get_active_sponsored_ads(
  p_ad_type text DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  merchant_id uuid,
  merchant_name text,
  ad_type text,
  title text,
  description text,
  image_url text,
  priority integer,
  impression_count integer,
  click_count integer,
  ctr numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $fn$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id,
    sa.merchant_id,
    m.name_ar as merchant_name,
    sa.ad_type,
    sa.title,
    sa.description,
    sa.image_url,
    sa.priority,
    sa.impression_count,
    sa.click_count,
    CASE 
      WHEN sa.impression_count > 0 
      THEN ROUND((sa.click_count::numeric / sa.impression_count::numeric) * 100, 2)
      ELSE 0
    END as ctr
  FROM public.sponsored_ads sa
  JOIN public.merchants m ON m.id = sa.merchant_id
  WHERE 
    sa.is_active = true
    AND sa.start_date <= now()
    AND sa.end_date >= now()
    AND sa.total_spent < sa.budget_amount
    AND (p_ad_type IS NULL OR sa.ad_type = p_ad_type)
  ORDER BY sa.priority DESC, sa.created_at DESC
  LIMIT p_limit;
END;
$fn$;

ALTER FUNCTION public.get_active_sponsored_ads(text, integer) SET search_path = public;

REVOKE ALL ON FUNCTION public.get_active_sponsored_ads(text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_active_sponsored_ads(text, integer) TO anon, authenticated;

COMMIT;
