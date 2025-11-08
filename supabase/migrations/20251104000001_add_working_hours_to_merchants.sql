-- Add working_hours column to merchants table
-- This will store the weekly schedule in JSONB format

ALTER TABLE merchants 
ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{
  "sunday": {"isOpen": true, "openTime": "09:00", "closeTime": "22:00"},
  "monday": {"isOpen": true, "openTime": "09:00", "closeTime": "22:00"},
  "tuesday": {"isOpen": true, "openTime": "09:00", "closeTime": "22:00"},
  "wednesday": {"isOpen": true, "openTime": "09:00", "closeTime": "22:00"},
  "thursday": {"isOpen": true, "openTime": "09:00", "closeTime": "22:00"},
  "friday": {"isOpen": false, "openTime": "09:00", "closeTime": "22:00"},
  "saturday": {"isOpen": true, "openTime": "09:00", "closeTime": "22:00"}
}'::jsonb;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_merchants_working_hours ON merchants USING gin(working_hours);

-- Add comment
COMMENT ON COLUMN merchants.working_hours IS 'Weekly working hours schedule in JSONB format';

-- Function to check if merchant is currently open
CREATE OR REPLACE FUNCTION is_merchant_open(merchant_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  schedule jsonb;
  current_day text;
  check_time time;
  day_schedule jsonb;
  is_open boolean;
  open_time time;
  close_time time;
BEGIN
  -- Get current day (lowercase, e.g., 'monday')
  current_day := lower(to_char(CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo', 'Day'));
  current_day := trim(current_day);
  
  -- Get current time
  check_time := (CURRENT_TIMESTAMP AT TIME ZONE 'Africa/Cairo')::time;
  
  -- Get merchant schedule
  SELECT working_hours INTO schedule
  FROM merchants
  WHERE id = merchant_id;
  
  -- If no schedule, assume open
  IF schedule IS NULL THEN
    RETURN true;
  END IF;
  
  -- Get schedule for current day
  day_schedule := schedule->current_day;
  
  -- If no schedule for this day, assume closed
  IF day_schedule IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if marked as open
  is_open := (day_schedule->>'isOpen')::boolean;
  
  IF NOT is_open THEN
    RETURN false;
  END IF;
  
  -- Get open and close times
  open_time := (day_schedule->>'openTime')::time;
  close_time := (day_schedule->>'closeTime')::time;
  
  -- Check if current time is within working hours
  RETURN check_time >= open_time AND check_time <= close_time;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION is_merchant_open(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_merchant_open(uuid) TO anon;
