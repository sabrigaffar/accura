-- Create sponsored_ads table for managing paid advertisements
CREATE TABLE IF NOT EXISTS sponsored_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  
  -- Ad Details
  ad_type text NOT NULL CHECK (ad_type IN ('banner', 'story', 'featured')),
  title text NOT NULL,
  description text,
  image_url text NOT NULL,
  
  -- Targeting & Display
  priority integer DEFAULT 1 CHECK (priority >= 1 AND priority <= 10),
  position integer, -- Order in carousel/grid
  
  -- Schedule
  start_date timestamptz NOT NULL DEFAULT now(),
  end_date timestamptz NOT NULL,
  is_active boolean DEFAULT true,
  
  -- Budget & Billing
  budget_amount numeric(10,2) DEFAULT 0,
  cost_per_click numeric(10,2) DEFAULT 0.5,
  cost_per_impression numeric(10,2) DEFAULT 0.01,
  total_spent numeric(10,2) DEFAULT 0,
  
  -- Analytics
  impression_count integer DEFAULT 0,
  click_count integer DEFAULT 0,
  conversion_count integer DEFAULT 0, -- Orders placed after clicking ad
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  CONSTRAINT valid_dates CHECK (end_date > start_date),
  CONSTRAINT budget_check CHECK (budget_amount >= 0),
  CONSTRAINT spent_check CHECK (total_spent >= 0 AND total_spent <= budget_amount)
);

-- Indexes for performance
CREATE INDEX idx_sponsored_ads_merchant ON sponsored_ads(merchant_id);
CREATE INDEX idx_sponsored_ads_type ON sponsored_ads(ad_type);
CREATE INDEX idx_sponsored_ads_active ON sponsored_ads(is_active) WHERE is_active = true;
CREATE INDEX idx_sponsored_ads_dates ON sponsored_ads(start_date, end_date);
CREATE INDEX idx_sponsored_ads_priority ON sponsored_ads(priority DESC);

-- Table for tracking individual ad impressions (for analytics)
CREATE TABLE IF NOT EXISTS ad_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now(),
  session_id text,
  
  -- Device/Location info
  device_type text,
  location_lat numeric,
  location_lng numeric
);

CREATE INDEX idx_ad_impressions_ad ON ad_impressions(ad_id);
CREATE INDEX idx_ad_impressions_user ON ad_impressions(user_id);
CREATE INDEX idx_ad_impressions_date ON ad_impressions(viewed_at);

-- Table for tracking ad clicks
CREATE TABLE IF NOT EXISTS ad_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id uuid NOT NULL REFERENCES sponsored_ads(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  clicked_at timestamptz DEFAULT now(),
  session_id text,
  
  -- Track if click resulted in order
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  converted boolean DEFAULT false
);

CREATE INDEX idx_ad_clicks_ad ON ad_clicks(ad_id);
CREATE INDEX idx_ad_clicks_user ON ad_clicks(user_id);
CREATE INDEX idx_ad_clicks_order ON ad_clicks(order_id);
CREATE INDEX idx_ad_clicks_converted ON ad_clicks(converted) WHERE converted = true;

-- Function to get active ads for display
CREATE OR REPLACE FUNCTION get_active_sponsored_ads(
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
  ctr numeric -- Click-through rate
) 
LANGUAGE plpgsql
STABLE
AS $$
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
  FROM sponsored_ads sa
  JOIN merchants m ON m.id = sa.merchant_id
  WHERE 
    sa.is_active = true
    AND sa.start_date <= now()
    AND sa.end_date >= now()
    AND sa.total_spent < sa.budget_amount
    AND (p_ad_type IS NULL OR sa.ad_type = p_ad_type)
  ORDER BY sa.priority DESC, sa.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to record ad impression
CREATE OR REPLACE FUNCTION record_ad_impression(
  p_ad_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL,
  p_device_type text DEFAULT NULL,
  p_location_lat numeric DEFAULT NULL,
  p_location_lng numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert impression record
  INSERT INTO ad_impressions (
    ad_id, 
    user_id, 
    session_id, 
    device_type, 
    location_lat, 
    location_lng
  )
  VALUES (
    p_ad_id, 
    p_user_id, 
    p_session_id, 
    p_device_type, 
    p_location_lat, 
    p_location_lng
  );
  
  -- Update ad impression count
  UPDATE sponsored_ads
  SET 
    impression_count = impression_count + 1,
    total_spent = total_spent + cost_per_impression
  WHERE id = p_ad_id;
END;
$$;

-- Function to record ad click
CREATE OR REPLACE FUNCTION record_ad_click(
  p_ad_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert click record
  INSERT INTO ad_clicks (ad_id, user_id, session_id)
  VALUES (p_ad_id, p_user_id, p_session_id);
  
  -- Update ad click count
  UPDATE sponsored_ads
  SET 
    click_count = click_count + 1,
    total_spent = total_spent + cost_per_click
  WHERE id = p_ad_id;
END;
$$;

-- Function to mark ad conversion (when order is placed)
CREATE OR REPLACE FUNCTION record_ad_conversion(
  p_ad_id uuid,
  p_order_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update the most recent click for this ad to mark conversion
  UPDATE ad_clicks
  SET 
    order_id = p_order_id,
    converted = true
  WHERE id = (
    SELECT id 
    FROM ad_clicks
    WHERE ad_id = p_ad_id
      AND order_id IS NULL
      AND clicked_at > now() - interval '24 hours'
    ORDER BY clicked_at DESC
    LIMIT 1
  );
  
  -- Update conversion count
  UPDATE sponsored_ads
  SET conversion_count = conversion_count + 1
  WHERE id = p_ad_id;
END;
$$;

-- Function to get ad analytics for merchant
CREATE OR REPLACE FUNCTION get_ad_analytics(
  p_merchant_id uuid,
  p_start_date timestamptz DEFAULT now() - interval '30 days',
  p_end_date timestamptz DEFAULT now()
)
RETURNS TABLE (
  ad_id uuid,
  ad_title text,
  ad_type text,
  impressions bigint,
  clicks bigint,
  conversions bigint,
  ctr numeric,
  conversion_rate numeric,
  total_spent numeric,
  roi numeric -- Return on investment
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sa.id as ad_id,
    sa.title as ad_title,
    sa.ad_type,
    COUNT(DISTINCT ai.id) as impressions,
    COUNT(DISTINCT ac.id) as clicks,
    COUNT(DISTINCT ac.id) FILTER (WHERE ac.converted = true) as conversions,
    CASE 
      WHEN COUNT(DISTINCT ai.id) > 0 
      THEN ROUND((COUNT(DISTINCT ac.id)::numeric / COUNT(DISTINCT ai.id)::numeric) * 100, 2)
      ELSE 0
    END as ctr,
    CASE 
      WHEN COUNT(DISTINCT ac.id) > 0 
      THEN ROUND((COUNT(DISTINCT ac.id) FILTER (WHERE ac.converted = true)::numeric / COUNT(DISTINCT ac.id)::numeric) * 100, 2)
      ELSE 0
    END as conversion_rate,
    sa.total_spent,
    CASE 
      WHEN sa.total_spent > 0 
      THEN ROUND(
        (COALESCE(SUM(o.customer_total), 0) - sa.total_spent) / sa.total_spent * 100, 
        2
      )
      ELSE 0
    END as roi
  FROM sponsored_ads sa
  LEFT JOIN ad_impressions ai ON ai.ad_id = sa.id 
    AND ai.viewed_at BETWEEN p_start_date AND p_end_date
  LEFT JOIN ad_clicks ac ON ac.ad_id = sa.id 
    AND ac.clicked_at BETWEEN p_start_date AND p_end_date
  LEFT JOIN orders o ON o.id = ac.order_id
  WHERE sa.merchant_id = p_merchant_id
  GROUP BY sa.id, sa.title, sa.ad_type, sa.total_spent;
END;
$$;

-- RLS Policies
ALTER TABLE sponsored_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;

-- Merchants can view and manage their own ads
CREATE POLICY merchants_manage_own_ads ON sponsored_ads
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    merchant_id IN (
      SELECT id FROM merchants WHERE owner_id = auth.uid()
    )
  );

-- Everyone can view active ads
CREATE POLICY public_view_active_ads ON sponsored_ads
  FOR SELECT
  USING (is_active = true AND start_date <= now() AND end_date >= now());

-- Merchants can view analytics for their ads
CREATE POLICY merchants_view_ad_impressions ON ad_impressions
  FOR SELECT
  USING (
    ad_id IN (
      SELECT sa.id FROM sponsored_ads sa
      JOIN merchants m ON m.id = sa.merchant_id
      WHERE m.owner_id = auth.uid()
    )
  );

CREATE POLICY merchants_view_ad_clicks ON ad_clicks
  FOR SELECT
  USING (
    ad_id IN (
      SELECT sa.id FROM sponsored_ads sa
      JOIN merchants m ON m.id = sa.merchant_id
      WHERE m.owner_id = auth.uid()
    )
  );

-- System can record impressions and clicks
CREATE POLICY system_record_impressions ON ad_impressions
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY system_record_clicks ON ad_clicks
  FOR INSERT
  WITH CHECK (true);

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_active_sponsored_ads(text, integer) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_ad_impression(uuid, uuid, text, text, numeric, numeric) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_ad_click(uuid, uuid, text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION record_ad_conversion(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ad_analytics(uuid, timestamptz, timestamptz) TO authenticated;

-- Comments
COMMENT ON TABLE sponsored_ads IS 'Stores sponsored advertisement campaigns for merchants';
COMMENT ON TABLE ad_impressions IS 'Tracks when ads are viewed by users';
COMMENT ON TABLE ad_clicks IS 'Tracks when users click on ads';
COMMENT ON FUNCTION get_active_sponsored_ads IS 'Returns currently active ads filtered by type and priority';
COMMENT ON FUNCTION record_ad_impression IS 'Records an ad view and updates metrics';
COMMENT ON FUNCTION record_ad_click IS 'Records an ad click and updates metrics';
COMMENT ON FUNCTION record_ad_conversion IS 'Marks an ad click as converted when order is placed';
COMMENT ON FUNCTION get_ad_analytics IS 'Returns detailed analytics for merchant ads';
