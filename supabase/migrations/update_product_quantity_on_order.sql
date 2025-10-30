-- تحديث كمية المنتجات عند قبول الطلب
-- يتم تشغيله تلقائياً عندما يتغير status من pending إلى accepted

CREATE OR REPLACE FUNCTION update_product_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط عندما يتغير الـ status من pending إلى accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- تحديث كميات المنتجات
    UPDATE products p
    SET quantity = p.quantity - oi.quantity
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = p.id
      AND p.quantity >= oi.quantity;  -- تأكد من وجود كمية كافية
    
    -- Log للتتبع
    RAISE NOTICE 'Updated product quantities for order %', NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إنشاء Trigger
DROP TRIGGER IF EXISTS on_order_accepted ON orders;
CREATE TRIGGER on_order_accepted
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_product_quantities();

-- تعليق
COMMENT ON FUNCTION update_product_quantities() IS 'Automatically updates product quantities when an order is accepted';
