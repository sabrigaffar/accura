-- Admin approval RPCs for drivers and merchants with notifications
-- Date: 2025-11-08

BEGIN;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_driver_profiles_approval_status ON public.driver_profiles(approval_status);
CREATE INDEX IF NOT EXISTS idx_merchants_approval_status ON public.merchants(approval_status);

-- Driver approval
CREATE OR REPLACE FUNCTION public.admin_update_driver_approval(
  p_driver_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
) RETURNS TABLE(ok boolean, new_status text) 
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_now timestamptz := now();
  v_status text;
BEGIN
  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid action %', p_action;
  END IF;

  IF p_action = 'approve' THEN
    UPDATE public.driver_profiles
    SET approval_status = 'approved',
        is_verified = true,
        approved_by = auth.uid(),
        approved_at = v_now,
        approval_notes = COALESCE(p_notes, approval_notes),
        updated_at = v_now
    WHERE id = p_driver_id;
    v_status := 'approved';
  ELSE
    UPDATE public.driver_profiles
    SET approval_status = 'rejected',
        is_verified = false,
        approved_by = auth.uid(),
        rejected_at = v_now,
        approval_notes = COALESCE(p_notes, approval_notes),
        updated_at = v_now
    WHERE id = p_driver_id;
    v_status := 'rejected';
  END IF;

  -- Notify the driver
  INSERT INTO public.notifications(user_id, title, body, type, data)
  VALUES (
    p_driver_id,
    CASE WHEN v_status='approved' THEN 'تمت الموافقة على حسابك' ELSE 'تم رفض طلب الحساب' END,
    CASE WHEN v_status='approved' THEN 'أصبحت جاهزاً لاستلام الطلبات.' ELSE COALESCE('تم رفض الطلب. ' || COALESCE(p_notes,''),'تم رفض الطلب.') END,
    'system',
    jsonb_build_object('role','driver','status',v_status)
  );

  ok := true; new_status := v_status; RETURN NEXT; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_update_driver_approval(uuid,text,text) TO authenticated;

-- Merchant approval
CREATE OR REPLACE FUNCTION public.admin_update_merchant_approval(
  p_merchant_id uuid,
  p_action text,
  p_notes text DEFAULT NULL
) RETURNS TABLE(ok boolean, new_status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_admin boolean;
  v_now timestamptz := now();
  v_status text;
  v_owner uuid;
BEGIN
  v_is_admin := public.is_admin();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  IF p_action NOT IN ('approve','reject') THEN
    RAISE EXCEPTION 'invalid action %', p_action;
  END IF;

  SELECT owner_id INTO v_owner FROM public.merchants WHERE id = p_merchant_id;

  IF p_action = 'approve' THEN
    UPDATE public.merchants
    SET approval_status = 'approved',
        is_active = true,
        approved_by = auth.uid(),
        approved_at = v_now,
        approval_notes = COALESCE(p_notes, approval_notes),
        updated_at = v_now
    WHERE id = p_merchant_id;
    v_status := 'approved';
  ELSE
    UPDATE public.merchants
    SET approval_status = 'rejected',
        is_active = false,
        approved_by = auth.uid(),
        rejected_at = v_now,
        approval_notes = COALESCE(p_notes, approval_notes),
        updated_at = v_now
    WHERE id = p_merchant_id;
    v_status := 'rejected';
  END IF;

  -- Notify the owner user
  IF v_owner IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, type, data)
    VALUES (
      v_owner,
      CASE WHEN v_status='approved' THEN 'تمت الموافقة على متجرك' ELSE 'تم رفض طلب المتجر' END,
      CASE WHEN v_status='approved' THEN 'يمكنك الآن استخدام لوحة المتجر.' ELSE COALESCE('تم رفض الطلب. ' || COALESCE(p_notes,''),'تم رفض الطلب.') END,
      'system',
      jsonb_build_object('role','merchant','status',v_status, 'merchant_id', p_merchant_id)
    );
  END IF;

  ok := true; new_status := v_status; RETURN NEXT; RETURN;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_update_merchant_approval(uuid,text,text) TO authenticated;

COMMIT;
