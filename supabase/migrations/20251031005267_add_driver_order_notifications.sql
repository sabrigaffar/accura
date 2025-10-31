-- إشعارات تلقائية للسائقين عند تغيير حالة الطلب
-- هذا يُكمل نظام Push Notifications الموجود

-- 1. دالة إرسال إشعار للسائق عند تحديث الطلب
CREATE OR REPLACE FUNCTION notify_driver_on_order_update()
RETURNS TRIGGER AS $$
DECLARE
  driver_token TEXT;
  notification_title TEXT;
  notification_body TEXT;
BEGIN
  -- فقط إذا كان هناك سائق معيّن للطلب
  IF NEW.driver_id IS NOT NULL THEN
    -- جلب push token للسائق
    SELECT push_token INTO driver_token
    FROM driver_profiles
    WHERE id = NEW.driver_id AND push_enabled = true;

    -- إذا وُجد token، أرسل إشعار حسب الحالة
    IF driver_token IS NOT NULL THEN
      -- تحديد نص الإشعار حسب الحالة
      CASE NEW.status
        WHEN 'out_for_delivery' THEN
          -- عند قبول الطلب
          IF OLD.status = 'ready' THEN
            notification_title := '✅ تم قبول الطلب';
            notification_body := 'طلب رقم ' || NEW.order_number || ' - ابدأ التوصيل الآن';
          END IF;
        WHEN 'delivered' THEN
          -- عند إكمال التوصيل
          notification_title := '🎉 تم التوصيل بنجاح';
          notification_body := 'تم تسليم الطلب ' || NEW.order_number || ' - تمت إضافة ' || NEW.delivery_fee || ' إلى حسابك';
        ELSE
          -- تحديثات أخرى
          IF NEW.picked_up_at IS NOT NULL AND OLD.picked_up_at IS NULL THEN
            notification_title := '📦 تم الاستلام';
            notification_body := 'تم استلام الطلب ' || NEW.order_number || ' من المتجر';
          ELSIF NEW.heading_to_customer_at IS NOT NULL AND OLD.heading_to_customer_at IS NULL THEN
            notification_title := '🚗 في الطريق';
            notification_body := 'أنت الآن في الطريق إلى العميل - طلب ' || NEW.order_number;
          END IF;
      END CASE;

      -- إدراج الإشعار إذا كان هناك نص
      IF notification_title IS NOT NULL THEN
        -- يمكن إضافة جدول notifications أو استخدام خدمة خارجية
        -- هنا نحفظ فقط في driver_profiles.last_notification_at
        UPDATE driver_profiles
        SET last_notification_at = NOW()
        WHERE id = NEW.driver_id;
        
        -- TODO: إرسال الإشعار عبر Expo Push Notifications API
        -- يمكن استخدام pg_net أو Edge Function لإرسال الإشعار
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger عند تحديث الطلب
DROP TRIGGER IF EXISTS on_order_update_notify_driver ON orders;
CREATE TRIGGER on_order_update_notify_driver
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status 
    OR OLD.picked_up_at IS DISTINCT FROM NEW.picked_up_at
    OR OLD.heading_to_customer_at IS DISTINCT FROM NEW.heading_to_customer_at
    OR OLD.heading_to_merchant_at IS DISTINCT FROM NEW.heading_to_merchant_at)
  EXECUTE FUNCTION notify_driver_on_order_update();

-- 3. جدول لتخزين سجل الإشعارات (اختياري)
CREATE TABLE IF NOT EXISTS driver_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID REFERENCES driver_profiles(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index للأداء
CREATE INDEX IF NOT EXISTS idx_driver_notifications_driver ON driver_notifications(driver_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_notifications_unread ON driver_notifications(driver_id, read_at) WHERE read_at IS NULL;

-- RLS للإشعارات
ALTER TABLE driver_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Drivers can view their notifications" ON driver_notifications;
CREATE POLICY "Drivers can view their notifications"
  ON driver_notifications FOR SELECT
  TO authenticated
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Drivers can update their notifications" ON driver_notifications;
CREATE POLICY "Drivers can update their notifications"
  ON driver_notifications FOR UPDATE
  TO authenticated
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

COMMENT ON TABLE driver_notifications IS 'سجل الإشعارات المرسلة للسائقين';
COMMENT ON FUNCTION notify_driver_on_order_update() IS 'دالة تلقائية لإرسال إشعارات للسائق عند تحديث حالة الطلب';
