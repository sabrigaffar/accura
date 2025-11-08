-- Create admin_users table and rewrite is_admin() to avoid RLS recursion on profiles
-- Date: 2025-11-08

BEGIN;

-- 1) admin_users: لائحة ثابتة بهويات الأدمن لتسهيل الفحص داخل السياسات بدون الرجوع إلى profiles
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS: السماح بالقراءة للجميع (authenticated) كي تعمل السياسات التي تستعلم عنها بدون تعقيد
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_users_select_all ON public.admin_users;
CREATE POLICY admin_users_select_all ON public.admin_users FOR SELECT TO authenticated USING (true);

-- 2) تعبئة أولية من profiles حيث user_type='admin'
INSERT INTO public.admin_users (user_id)
SELECT id FROM public.profiles WHERE user_type = 'admin'
ON CONFLICT (user_id) DO NOTHING;

-- 3) إعادة تعريف is_admin() للاعتماد على admin_users بدل profiles
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = auth.uid()
  );
$fn$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

COMMIT;
