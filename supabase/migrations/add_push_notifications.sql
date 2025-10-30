-- إضافة حقول Push Notifications إلى جدول driver_profiles
ALTER TABLE driver_profiles
ADD COLUMN IF NOT EXISTS push_token TEXT,
ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_notification_at TIMESTAMP WITH TIME ZONE;

-- إنشاء index لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_driver_push_token ON driver_profiles(push_token) WHERE push_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_driver_push_enabled ON driver_profiles(push_enabled) WHERE push_enabled = true;

-- دالة لإرسال إشعار للسائقين المتاحين
CREATE OR REPLACE FUNCTION notify_available_drivers(order_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  driver_record RECORD;
BEGIN
  -- جلب جميع السائقين المتاحين (online + لديهم push_token)
  FOR driver_record IN 
    SELECT id, push_token, full_name
    FROM driver_profiles
    WHERE is_online = true 
      AND push_enabled = true 
      AND push_token IS NOT NULL
  LOOP
    -- هنا يمكنك إضافة منطق الإشعارات الخارجية (مثل Firebase Cloud Functions)
    -- لكن للبساطة، سنقوم بتسجيل الحدث فقط
    RAISE NOTICE 'Notify driver % about order %', driver_record.full_name, order_id;
  END LOOP;
END;
$$;

-- Trigger لإرسال إشعارات عند إنشاء طلب جديد
CREATE OR REPLACE FUNCTION trigger_new_order_notifications()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- إذا كان الطلب جديد (pending)
  IF NEW.status = 'pending' THEN
    -- استدعاء دالة الإشعارات
    PERFORM notify_available_drivers(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

-- إنشاء trigger إذا لم يكن موجوداً
DROP TRIGGER IF EXISTS new_order_notification_trigger ON orders;
CREATE TRIGGER new_order_notification_trigger
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION trigger_new_order_notifications();

-- تعليق على الجدول
COMMENT ON COLUMN driver_profiles.push_token IS 'Expo Push Token للإشعارات';
COMMENT ON COLUMN driver_profiles.push_enabled IS 'هل الإشعارات مفعلة للسائق';
COMMENT ON COLUMN driver_profiles.last_notification_at IS 'آخر مرة تم إرسال إشعار للسائق';
