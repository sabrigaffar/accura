-- Notify customer on order creation (cart confirmation)
-- Date: 2025-11-13

BEGIN;

CREATE OR REPLACE FUNCTION public.notify_customer_on_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_title text;
  v_body text;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_title := 'تم استلام طلبك';
  v_body  := 'تم إنشاء طلبك رقم ' || NEW.order_number || ' وبانتظار قبول المتجر.';

  INSERT INTO public.notifications(user_id, title, body, type, data)
  VALUES (
    NEW.customer_id,
    v_title,
    v_body,
    'order',
    jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', COALESCE(NEW.status::text, 'pending'))
  );

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_order_insert_notify_customer ON public.orders;
CREATE TRIGGER on_order_insert_notify_customer
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_customer_on_order_created();

COMMIT;
