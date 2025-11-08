-- تحديث كمية المنتجات عند قبول الطلب
-- يتم تشغيله تلقائياً عندما يتغير status من pending إلى accepted

CREATE OR REPLACE FUNCTION update_product_quantities()
RETURNS TRIGGER AS $$
BEGIN
  -- فقط عندما يتغير الـ status من pending إلى accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    -- تحديث مخزون المنتجات من جدول merchant_products (اعتمدنا stock بدلاً من quantity)
    UPDATE merchant_products mp
    SET stock = GREATEST(0, COALESCE(mp.stock, 0) - oi.quantity)
    FROM order_items oi
    WHERE oi.order_id = NEW.id
      AND oi.product_id = mp.id;
    
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
