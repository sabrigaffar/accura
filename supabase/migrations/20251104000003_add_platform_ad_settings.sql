-- Create platform settings table for ad pricing
CREATE TABLE IF NOT EXISTS platform_ad_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Ad pricing
  cost_per_click numeric(10,2) DEFAULT 0.5,
  cost_per_impression numeric(10,2) DEFAULT 0.01,
  
  -- Ad limits and rules
  min_budget numeric(10,2) DEFAULT 100,
  max_budget numeric(10,2) DEFAULT 10000,
  min_duration_days integer DEFAULT 7,
  max_duration_days integer DEFAULT 90,
  
  -- Commission
  platform_commission_percentage numeric(5,2) DEFAULT 10, -- 10% commission on ad spend
  
  -- Payment settings
  requires_payment_upfront boolean DEFAULT true,
  auto_pause_on_budget_exceeded boolean DEFAULT true,
  
  -- Updated tracking
  updated_at timestamptz DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id),
  
  -- Only one row allowed
  CONSTRAINT only_one_settings_row CHECK (id = '00000000-0000-0000-0000-000000000001')
);

-- Insert default settings (only one row)
INSERT INTO platform_ad_settings (id, cost_per_click, cost_per_impression)
VALUES ('00000000-0000-0000-0000-000000000001', 0.5, 0.01)
ON CONFLICT (id) DO NOTHING;

-- Function to get current ad pricing
CREATE OR REPLACE FUNCTION get_ad_pricing()
RETURNS TABLE (
  cost_per_click numeric,
  cost_per_impression numeric,
  min_budget numeric,
  max_budget numeric,
  min_duration_days integer,
  max_duration_days integer
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.cost_per_click,
    s.cost_per_impression,
    s.min_budget,
    s.max_budget,
    s.min_duration_days,
    s.max_duration_days
  FROM platform_ad_settings s
  WHERE id = '00000000-0000-0000-0000-000000000001';
END;
$$;

-- Update record_ad_impression to use dynamic pricing
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
DECLARE
  v_cost_per_impression numeric;
BEGIN
  -- Get current pricing
  SELECT cost_per_impression INTO v_cost_per_impression
  FROM platform_ad_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
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
  
  -- Update ad impression count and cost
  UPDATE sponsored_ads
  SET 
    impression_count = impression_count + 1,
    total_spent = total_spent + v_cost_per_impression
  WHERE id = p_ad_id;
END;
$$;

-- Update record_ad_click to use dynamic pricing
CREATE OR REPLACE FUNCTION record_ad_click(
  p_ad_id uuid,
  p_user_id uuid DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_cost_per_click numeric;
BEGIN
  -- Get current pricing
  SELECT cost_per_click INTO v_cost_per_click
  FROM platform_ad_settings
  WHERE id = '00000000-0000-0000-0000-000000000001';
  
  -- Insert click record
  INSERT INTO ad_clicks (ad_id, user_id, session_id)
  VALUES (p_ad_id, p_user_id, p_session_id);
  
  -- Update ad click count and cost
  UPDATE sponsored_ads
  SET 
    click_count = click_count + 1,
    total_spent = total_spent + v_cost_per_click
  WHERE id = p_ad_id;
END;
$$;

-- RLS Policies
ALTER TABLE platform_ad_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS admin_manage_ad_settings ON platform_ad_settings;
DROP POLICY IF EXISTS public_read_ad_settings ON platform_ad_settings;

-- Only admins can update settings (you'll need to define admin role)
CREATE POLICY admin_manage_ad_settings ON platform_ad_settings
  FOR ALL
  USING (auth.jwt()->>'role' = 'admin')
  WITH CHECK (auth.jwt()->>'role' = 'admin');

-- Everyone can read settings
CREATE POLICY public_read_ad_settings ON platform_ad_settings
  FOR SELECT
  USING (true);

-- Grant permissions
GRANT SELECT ON platform_ad_settings TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_ad_pricing() TO authenticated, anon;

-- Comments
COMMENT ON TABLE platform_ad_settings IS 'Platform-wide settings for sponsored ads pricing and rules';
COMMENT ON FUNCTION get_ad_pricing IS 'Returns current ad pricing settings';
