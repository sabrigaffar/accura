-- ⚠️ SQL النهائي لإصلاح مشكلة التسجيل
-- نفذ هذا في Supabase Dashboard → SQL Editor

-- 1. حذف الـ trigger والـ function القديمة تماماً
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. إنشاء function جديدة مع SET search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_type, full_name, phone_number, is_active, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'user_type', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'مستخدم'),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone_number', ''),
    true,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- في حالة حدوث أي خطأ، نسجله لكن لا نوقف إنشاء المستخدم
    RAISE WARNING 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- 3. إنشاء الـ trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 4. منح جميع الصلاحيات اللازمة
GRANT ALL ON public.profiles TO postgres, anon, authenticated, service_role;

-- 5. تعطيل RLS مؤقتاً للـ profiles (لحل المشكلة)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;

-- 6. إعادة تفعيل RLS مع policies صحيحة
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- حذف جميع policies القديمة
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- إنشاء policies جديدة
-- أي شخص يمكنه القراءة (مهم للسائقين/التجار)
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- المستخدمون المصادق عليهم يمكنهم إنشاء profiles
CREATE POLICY "Authenticated users can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- المستخدمون يمكنهم تحديث profiles الخاصة بهم فقط
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 7. تحديث policies للعناوين
DROP POLICY IF EXISTS "Users can view own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can insert own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can update own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can delete own addresses" ON addresses;

CREATE POLICY "Users can view own addresses"
  ON addresses FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own addresses"
  ON addresses FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own addresses"
  ON addresses FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own addresses"
  ON addresses FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- 8. التأكد من تفعيل RLS على addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- ✅ انتهى! اضغط RUN
-- بعد التنفيذ، جرب التسجيل مرة أخرى
