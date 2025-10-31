-- Unify delivery fee policy between client and server
-- Canonical: fee = CEIL(distance_km) * 10, with minimum 10 EGP
-- Trigger will also align delivery_fee = calculated_delivery_fee and provide fallback when store coords are missing

-- 1) Canonical function
CREATE OR REPLACE FUNCTION calculate_delivery_fee(distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
  kilometers INTEGER;
  fee NUMERIC;
BEGIN
  IF distance_km IS NULL OR distance_km <= 0 THEN
    RETURN 10; -- minimum base
  END IF;
  kilometers := CEIL(distance_km);
  fee := GREATEST(kilometers * 10, 10);
  RETURN fee;
END;
$$;

-- 2) Trigger: update_order_delivery_info
CREATE OR REPLACE FUNCTION update_order_delivery_info()
RETURNS TRIGGER AS $$
DECLARE
  merchant_lat NUMERIC;
  merchant_lon NUMERIC;
  distance NUMERIC;
BEGIN
  -- Fetch store location
  SELECT latitude, longitude INTO merchant_lat, merchant_lon
  FROM merchants m WHERE m.id = NEW.merchant_id;

  -- Compute distance if both coords available
  IF merchant_lat IS NOT NULL AND merchant_lon IS NOT NULL AND
     NEW.customer_latitude IS NOT NULL AND NEW.customer_longitude IS NOT NULL THEN

    distance := calculate_distance(merchant_lat, merchant_lon, NEW.customer_latitude, NEW.customer_longitude);
    NEW.delivery_distance_km := distance;
    NEW.calculated_delivery_fee := calculate_delivery_fee(distance);

  ELSE
    -- Fallback when we cannot compute distance: trust provided fee or default 10
    NEW.calculated_delivery_fee := COALESCE(NEW.calculated_delivery_fee, NEW.delivery_fee, 10);
  END IF;

  -- Align delivery_fee with calculated value to keep a single source of truth
  NEW.delivery_fee := NEW.calculated_delivery_fee;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger to ensure latest body is used
DROP TRIGGER IF EXISTS trigger_update_order_delivery_info ON orders;
CREATE TRIGGER trigger_update_order_delivery_info
  BEFORE INSERT OR UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_delivery_info();
