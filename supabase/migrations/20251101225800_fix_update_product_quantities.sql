-- Fix: update_product_quantities should update merchant_products.stock instead of products.quantity
-- Safe to run multiple times (CREATE OR REPLACE)

BEGIN;

CREATE OR REPLACE FUNCTION update_product_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- Only when status changes from pending to accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- Update stock in merchant_products using order_items quantities
    UPDATE merchant_products mp
    SET stock = GREATEST(0, COALESCE(mp.stock, 0) - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = mp.id;

    RAISE NOTICE 'Updated merchant_products stock for order %', NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Ensure trigger exists and uses the updated function
DROP TRIGGER IF EXISTS on_order_accepted ON orders;
CREATE TRIGGER on_order_accepted
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_product_quantities();

COMMIT;
