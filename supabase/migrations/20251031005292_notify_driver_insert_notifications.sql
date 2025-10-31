-- Enhance driver notifications: also insert into public.notifications

CREATE OR REPLACE FUNCTION public.notify_driver_on_order_update()
RETURNS TRIGGER AS $$
DECLARE
  driver_token TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- فقط إذا كان هناك سائق معيّن للطلب
  IF NEW.driver_id IS NOT NULL THEN
    -- جلب push token للسائق (اختياري للاستخدام الخارجي)
    SELECT push_token INTO driver_token
    FROM public.driver_profiles
    WHERE id = NEW.driver_id AND push_enabled = true;

    -- بناء نص الإشعار حسب الحالة أو التوقيتات
    CASE NEW.status::text
      WHEN 'out_for_delivery' THEN
        IF OLD.status = 'ready' THEN
          notification_title := '✅ تم قبول الطلب';
          notification_body := 'طلب رقم ' || NEW.order_number || ' - ابدأ التوصيل الآن';
        END IF;
      WHEN 'delivered' THEN
        notification_title := '🎉 تم التوصيل بنجاح';
        notification_body := 'تم تسليم الطلب ' || NEW.order_number || ' - تمت إضافة ' || COALESCE(NEW.delivery_fee::text,'0') || ' إلى حسابك';
      WHEN 'picked_up' THEN
        notification_title := '📦 تم الاستلام';
        notification_body := 'تم استلام الطلب ' || NEW.order_number || ' من المتجر';
      WHEN 'heading_to_customer' THEN
        notification_title := '🚗 في الطريق';
        notification_body := 'أنت الآن في الطريق إلى العميل - طلب ' || NEW.order_number;
    END CASE;

    -- بدائل بناءً على أعمدة التوقيت
    IF notification_title IS NULL THEN
      IF NEW.picked_up_at IS NOT NULL AND OLD.picked_up_at IS NULL THEN
        notification_title := '📦 تم الاستلام';
        notification_body := 'تم استلام الطلب ' || NEW.order_number || ' من المتجر';
      ELSIF NEW.heading_to_customer_at IS NOT NULL AND OLD.heading_to_customer_at IS NULL THEN
        notification_title := '🚗 في الطريق';
        notification_body := 'أنت الآن في الطريق إلى العميل - طلب ' || NEW.order_number;
      END IF;
    END IF;

    -- تحديث آخر وقت إشعار وإدراج سجل عام للإشعارات للعرض في التطبيق
    IF notification_title IS NOT NULL THEN
      UPDATE public.driver_profiles
      SET last_notification_at = NOW()
      WHERE id = NEW.driver_id;

      INSERT INTO public.notifications (user_id, title, body, type, data)
      VALUES (
        NEW.driver_id,
        notification_title,
        notification_body,
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- تأكيد وجود الـ Trigger
DROP TRIGGER IF EXISTS on_order_update_notify_driver ON public.orders;
CREATE TRIGGER on_order_update_notify_driver
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status 
    OR OLD.picked_up_at IS DISTINCT FROM NEW.picked_up_at
    OR OLD.heading_to_customer_at IS DISTINCT FROM NEW.heading_to_customer_at
    OR OLD.heading_to_merchant_at IS DISTINCT FROM NEW.heading_to_merchant_at
  )
  EXECUTE FUNCTION public.notify_driver_on_order_update();

COMMENT ON FUNCTION public.notify_driver_on_order_update() IS 'Insert notifications for drivers on order updates and update last_notification_at';
