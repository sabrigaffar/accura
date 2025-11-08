-- Admin analytics for sponsored ads that bypasses RLS via SECURITY DEFINER
BEGIN;

CREATE OR REPLACE FUNCTION public.get_admin_ad_analytics(
  p_ad_ids uuid[] DEFAULT NULL,
  p_start_date timestamptz DEFAULT now() - interval '30 days',
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE (
  ad_id uuid,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  total_spent numeric,
  ctr numeric,
  roi numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
BEGIN
  RETURN QUERY
  SELECT 
    sa.id AS ad_id,
    COUNT(DISTINCT ai.id) AS impressions,
    COUNT(DISTINCT ac.id) AS clicks,
    COUNT(DISTINCT ac.id) FILTER (WHERE ac.converted = true) AS conversions,
    COALESCE(sa.total_spent, 0) AS total_spent,
    CASE WHEN COUNT(DISTINCT ai.id) > 0
      THEN ROUND((COUNT(DISTINCT ac.id)::numeric / COUNT(DISTINCT ai.id)::numeric) * 100, 2)
      ELSE 0
    END AS ctr,
    CASE WHEN COALESCE(sa.total_spent,0) > 0 THEN ROUND(((COALESCE(SUM(o.customer_total),0) - COALESCE(sa.total_spent,0)) / COALESCE(sa.total_spent,0)) * 100, 2) ELSE 0 END AS roi
  FROM public.sponsored_ads sa
  LEFT JOIN public.ad_impressions ai ON ai.ad_id = sa.id AND ai.viewed_at BETWEEN p_start_date AND p_end_date
  LEFT JOIN public.ad_clicks ac ON ac.ad_id = sa.id AND ac.clicked_at BETWEEN p_start_date AND p_end_date
  LEFT JOIN public.orders o ON o.id = ac.order_id
  WHERE (p_ad_ids IS NULL OR sa.id = ANY(p_ad_ids))
  GROUP BY sa.id, sa.total_spent;
END; $$;

GRANT EXECUTE ON FUNCTION public.get_admin_ad_analytics(uuid[], timestamptz, timestamptz) TO authenticated;

COMMIT;
