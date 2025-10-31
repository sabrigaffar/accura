-- Notifications for merchant and customer on order events

-- 1) Customer: notify on order status updates
CREATE OR REPLACE FUNCTION public.notify_customer_on_order_update()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
BEGIN
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    CASE NEW.status::text
      WHEN 'heading_to_merchant' THEN
        v_title := 'تم قبول طلبك';
        v_body := 'السائق في طريقه للمتجر لبدء التوصيل. رقم الطلب ' || NEW.order_number;
      WHEN 'picked_up' THEN
        v_title := 'تم استلام طلبك';
        v_body := 'السائق استلم الطلب من المتجر. رقم الطلب ' || NEW.order_number;
      WHEN 'heading_to_customer' THEN
        v_title := 'في الطريق إليك';
        v_body := 'سائقنا في الطريق لتسليم طلبك. رقم الطلب ' || NEW.order_number;
      WHEN 'delivered' THEN
        v_title := 'تم تسليم طلبك';
        v_body := 'تم تسليم الطلب بنجاح. شكراً لك!';
    END CASE;
  END IF;

  IF v_title IS NULL THEN
    IF NEW.picked_up_at IS NOT NULL AND OLD.picked_up_at IS NULL THEN
      v_title := 'تم استلام طلبك';
      v_body := 'السائق استلم الطلب من المتجر. رقم الطلب ' || NEW.order_number;
    ELSIF NEW.heading_to_customer_at IS NOT NULL AND OLD.heading_to_customer_at IS NULL THEN
      v_title := 'في الطريق إليك';
      v_body := 'سائقنا في الطريق لتسليم طلبك. رقم الطلب ' || NEW.order_number;
    END IF;
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      NEW.customer_id,
      v_title,
      v_body,
      'order',
      jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status::text)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_update_notify_customer ON public.orders;
CREATE TRIGGER on_order_update_notify_customer
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.picked_up_at IS DISTINCT FROM NEW.picked_up_at OR
    OLD.heading_to_customer_at IS DISTINCT FROM NEW.heading_to_customer_at
  )
  EXECUTE FUNCTION public.notify_customer_on_order_update();


-- 2) Merchant: notify on new orders and status updates
CREATE OR REPLACE FUNCTION public.notify_merchant_on_order_events()
RETURNS TRIGGER AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_body text;
  v_id uuid;
  v_order_number text;
  v_status text;
BEGIN
  SELECT owner_id INTO v_owner FROM public.merchants WHERE id = COALESCE(NEW.merchant_id, OLD.merchant_id);
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_id := NEW.id; v_order_number := NEW.order_number; v_status := COALESCE(NEW.status::text, 'pending');
    v_title := 'طلب جديد';
    v_body := 'طلب جديد رقم ' || v_order_number || ' بانتظار المعالجة';
  ELSIF TG_OP = 'UPDATE' THEN
    v_id := COALESCE(NEW.id, OLD.id);
    v_order_number := COALESCE(NEW.order_number, OLD.order_number);
    v_status := COALESCE(NEW.status, OLD.status)::text;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      CASE NEW.status::text
        WHEN 'heading_to_merchant' THEN
          v_title := 'تم قبول الطلب';
          v_body := 'سائق في طريقه لاستلام الطلب ' || v_order_number;
        WHEN 'picked_up' THEN
          v_title := 'تم استلام الطلب';
          v_body := 'السائق استلم الطلب ' || v_order_number;
        WHEN 'cancelled' THEN
          v_title := 'تم إلغاء الطلب';
          v_body := 'تم إلغاء الطلب ' || v_order_number;
        WHEN 'delivered' THEN
          v_title := 'تم التسليم';
          v_body := 'تم تسليم الطلب ' || v_order_number;
      END CASE;
    END IF;
  END IF;

  IF v_title IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, body, type, data)
    VALUES (
      v_owner,
      v_title,
      v_body,
      'order',
      jsonb_build_object('order_id', v_id, 'order_number', v_order_number, 'status', v_status)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_order_insert_notify_merchant ON public.orders;
CREATE TRIGGER on_order_insert_notify_merchant
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_merchant_on_order_events();

DROP TRIGGER IF EXISTS on_order_update_notify_merchant ON public.orders;
CREATE TRIGGER on_order_update_notify_merchant
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status OR
    OLD.picked_up_at IS DISTINCT FROM NEW.picked_up_at OR
    OLD.heading_to_merchant_at IS DISTINCT FROM NEW.heading_to_merchant_at
  )
  EXECUTE FUNCTION public.notify_merchant_on_order_events();

COMMENT ON FUNCTION public.notify_customer_on_order_update() IS 'Insert notifications for customers on order updates';
COMMENT ON FUNCTION public.notify_merchant_on_order_events() IS 'Insert notifications for merchant owners on order events';
