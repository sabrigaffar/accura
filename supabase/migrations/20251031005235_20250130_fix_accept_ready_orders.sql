-- ========================================
-- Fix: السماح للسائق بقبول الطلبات "ready"
-- Allow drivers to accept orders with status "ready"
-- ========================================

-- استبدال دالة accept_order_safe لدعم حالة "ready"
CREATE OR REPLACE FUNCTION accept_order_safe(p_order_id uuid)
RETURNS TABLE(accepted boolean, message text) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_driver_id uuid;
  v_order_status text;
  v_current_driver uuid;
  v_driver_has_active boolean;
BEGIN
  -- الحصول على معرف السائق
  v_driver_id := auth.uid();
  IF v_driver_id IS NULL THEN
    RETURN QUERY SELECT false, 'يجب تسجيل الدخول'::text;
    RETURN;
  END IF;

  -- جلب معلومات الطلب
  SELECT status, driver_id INTO v_order_status, v_current_driver
  FROM orders WHERE id = p_order_id;

  IF v_order_status IS NULL THEN
    RETURN QUERY SELECT false, 'الطلب غير موجود'::text;
    RETURN;
  END IF;

  -- ✅ السماح بقبول الطلبات بحالة "pending" أو "ready"
  IF v_order_status NOT IN ('pending', 'ready') THEN
    RETURN QUERY SELECT false, 'الطلب غير متاح للقبول. الحالة الحالية: ' || v_order_status::text;
    RETURN;
  END IF;

  -- التحقق من أن الطلب غير مسند لسائق آخر
  IF v_current_driver IS NOT NULL THEN
    RETURN QUERY SELECT false, 'الطلب مسند لسائق آخر'::text;
    RETURN;
  END IF;

  -- التحقق من عدم وجود طلب نشط للسائق
  SELECT EXISTS(
    SELECT 1 FROM orders 
    WHERE driver_id = v_driver_id 
    AND status IN ('accepted', 'picked_up', 'heading_to_merchant', 'heading_to_customer', 'ready')
  ) INTO v_driver_has_active;

  IF v_driver_has_active THEN
    RETURN QUERY SELECT false, 'لديك طلب نشط بالفعل'::text;
    RETURN;
  END IF;

  -- قبول الطلب
  UPDATE orders 
  SET driver_id = v_driver_id,
      status = CASE 
        WHEN status = 'pending' THEN 'accepted'
        WHEN status = 'ready' THEN 'picked_up'  -- إذا كان جاهز، يصبح "مستلم"
        ELSE status
      END,
      updated_at = now()  -- تحديث التاريخ فقط
  WHERE id = p_order_id 
    AND status IN ('pending', 'ready')
    AND driver_id IS NULL;

  IF FOUND THEN
    RETURN QUERY SELECT true, 'تم قبول الطلب بنجاح'::text;
  ELSE
    RETURN QUERY SELECT false, 'فشل قبول الطلب. ربما تم قبوله من سائق آخر'::text;
  END IF;
END;
$$;

-- منح الصلاحيات
GRANT EXECUTE ON FUNCTION accept_order_safe TO authenticated;

-- ========================================
-- تعليق توضيحي
-- ========================================
COMMENT ON FUNCTION accept_order_safe IS 
'دالة آمنة لقبول الطلبات. تدعم الحالات:
- pending: يتحول إلى accepted
- ready: يتحول مباشرة إلى picked_up (مستلم من المطعم)';
