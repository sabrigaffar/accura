-- إصلاح CASE statement في triggers الإشعارات لإضافة ELSE
-- المشكلة: عند إلغاء الطلب (cancelled) لا يوجد حالة في CASE فيظهر خطأ

-- 1) إصلاح trigger إشعارات العميل
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
      WHEN 'on_the_way' THEN
        v_title := 'في الطريق إليك';
        v_body := 'سائقنا في الطريق لتسليم طلبك. رقم الطلب ' || NEW.order_number;
      WHEN 'delivered' THEN
        v_title := 'تم تسليم طلبك';
        v_body := 'تم تسليم الطلب بنجاح. شكراً لك!';
      WHEN 'cancelled' THEN
        v_title := 'تم إلغاء طلبك';
        v_body := 'تم إلغاء الطلب رقم ' || NEW.order_number;
      WHEN 'accepted' THEN
        v_title := 'تم قبول طلبك';
        v_body := 'المتجر قبل طلبك وسيبدأ التحضير قريباً. رقم الطلب ' || NEW.order_number;
      WHEN 'preparing' THEN
        v_title := 'طلبك قيد التحضير';
        v_body := 'المتجر يحضر طلبك الآن. رقم الطلب ' || NEW.order_number;
      WHEN 'ready' THEN
        v_title := 'طلبك جاهز';
        v_body := 'طلبك جاهز وفي انتظار السائق. رقم الطلب ' || NEW.order_number;
      ELSE
        -- حالة افتراضية لأي status آخر
        v_title := NULL;
        v_body := NULL;
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
    -- التحقق من وجود المستخدم في profiles قبل إدراج الإشعار
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.customer_id) THEN
      INSERT INTO public.notifications (user_id, title, body, type, data)
      VALUES (
        NEW.customer_id,
        v_title,
        v_body,
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2) إصلاح trigger إشعارات المتجر (إذا كان يحتوي نفس المشكلة)
CREATE OR REPLACE FUNCTION public.notify_merchant_on_order_events()
RETURNS TRIGGER AS $$
DECLARE
  v_title text;
  v_body text;
  v_merchant_id uuid;
BEGIN
  -- للطلبات الجديدة
  IF TG_OP = 'INSERT' THEN
    v_merchant_id := NEW.merchant_id;
    v_title := 'طلب جديد';
    v_body := 'لديك طلب جديد رقم ' || NEW.order_number;
  -- لتحديثات الحالة
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_merchant_id := NEW.merchant_id;
    CASE NEW.status::text
      WHEN 'cancelled' THEN
        v_title := 'تم إلغاء طلب';
        v_body := 'تم إلغاء الطلب رقم ' || NEW.order_number;
      WHEN 'delivered' THEN
        v_title := 'تم تسليم طلب';
        v_body := 'تم تسليم الطلب رقم ' || NEW.order_number || ' بنجاح';
      ELSE
        -- لا نرسل إشعار للمتجر في باقي الحالات
        v_title := NULL;
    END CASE;
  END IF;

  IF v_title IS NOT NULL AND v_merchant_id IS NOT NULL THEN
    -- التحقق من وجود المتجر في profiles قبل إدراج الإشعار
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_merchant_id) THEN
      INSERT INTO public.notifications (user_id, title, body, type, data)
      VALUES (
        v_merchant_id,
        v_title,
        v_body,
        'order',
        jsonb_build_object('order_id', NEW.id, 'order_number', NEW.order_number, 'status', NEW.status::text)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- التحقق من النجاح
SELECT 'Notification triggers fixed successfully' AS status;
