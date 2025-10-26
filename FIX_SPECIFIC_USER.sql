-- ⚠️ SQL لإصلاح المستخدم المحدد

-- 1. التحقق من وجود المستخدم في auth.users
SELECT 
  id,
  phone,
  created_at,
  raw_user_meta_data->>'user_type' as user_type_from_metadata,
  raw_user_meta_data->>'full_name' as full_name_from_metadata,
  raw_user_meta_data
FROM auth.users
WHERE id = '7b82dde2-3bc8-40dc-a92e-e6b0f87b0859';

-- 2. إنشاء profile للمستخدم يدوياً
INSERT INTO profiles (id, user_type, full_name, phone_number, is_active, created_at)
SELECT 
  '7b82dde2-3bc8-40dc-a92e-e6b0f87b0859'::uuid as id,
  COALESCE(raw_user_meta_data->>'user_type', 'merchant') as user_type,
  COALESCE(raw_user_meta_data->>'full_name', 'تاجر جديد') as full_name,
  COALESCE(phone, raw_user_meta_data->>'phone_number', '') as phone_number,
  true as is_active,
  created_at
FROM auth.users
WHERE id = '7b82dde2-3bc8-40dc-a92e-e6b0f87b0859'
ON CONFLICT (id) DO UPDATE SET
  user_type = EXCLUDED.user_type,
  full_name = EXCLUDED.full_name,
  phone_number = EXCLUDED.phone_number,
  updated_at = now();

-- 3. التحقق من النتيجة
SELECT 
  p.id,
  p.user_type,
  p.full_name,
  p.phone_number,
  p.is_active,
  p.created_at
FROM profiles p
WHERE p.id = '7b82dde2-3bc8-40dc-a92e-e6b0f87b0859';

-- 4. قائمة بجميع المستخدمين الذين ليس لهم profiles
SELECT 
  au.id,
  au.phone,
  au.created_at,
  au.raw_user_meta_data->>'user_type' as user_type,
  au.raw_user_meta_data->>'full_name' as full_name
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
)
ORDER BY au.created_at DESC;
