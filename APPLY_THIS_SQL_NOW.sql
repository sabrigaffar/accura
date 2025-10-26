-- ⚠️ طبّق هذا SQL في Supabase Dashboard - SQL Editor
-- هذا هو الحل النهائي لمشكلة RLS

-- 1. حذف الـ trigger والـ function القديمة
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 2. إنشاء function جديدة مع SECURITY DEFINER و SET search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_type, full_name, phone_number, is_active)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'user_type', 'customer'),
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    COALESCE(new.phone, new.raw_user_meta_data->>'phone_number', ''),
    true
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN new;
END;
$$;

-- 3. إنشاء الـ trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE FUNCTION public.handle_new_user();

-- 4. حذف جميع RLS policies القديمة من profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 5. إنشاء RLS policies جديدة للـ profiles
-- Policy للقراءة (يمكن للجميع قراءة profiles)
CREATE POLICY "Anyone can view profiles"
  ON profiles FOR SELECT
  USING (true);

-- Policy للإدراج (فقط المستخدمون المصادق عليهم)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Policy للتحديث (فقط المستخدم نفسه)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 6. منح صلاحيات للـ service role (مهم جداً!)
GRANT ALL ON profiles TO service_role;

-- 7. التأكد من تفعيل RLS على profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 8. تحديث RLS policies للعناوين
DROP POLICY IF EXISTS "Users can view their own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can insert their own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can update their own addresses" ON addresses;
DROP POLICY IF EXISTS "Users can delete their own addresses" ON addresses;

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

-- 9. التأكد من تفعيل RLS على addresses
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;

-- ✅ انتهى! اضغط RUN الآن
