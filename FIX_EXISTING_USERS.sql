-- ⚠️ نفذ هذا SQL لإنشاء profiles للمستخدمين الموجودين

-- إنشاء profiles للمستخدمين الذين ليس لديهم profile
INSERT INTO profiles (id, user_type, full_name, phone_number, is_active, created_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'user_type', 'customer') as user_type,
  COALESCE(au.raw_user_meta_data->>'full_name', 'مستخدم') as full_name,
  COALESCE(au.phone, au.raw_user_meta_data->>'phone_number', '') as phone_number,
  true as is_active,
  au.created_at
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = au.id
)
ON CONFLICT (id) DO UPDATE SET
  user_type = EXCLUDED.user_type,
  full_name = EXCLUDED.full_name,
  phone_number = EXCLUDED.phone_number;

-- تحقق من النتيجة
SELECT 
  p.id,
  p.user_type,
  p.full_name,
  p.phone_number,
  p.created_at
FROM profiles p
ORDER BY p.created_at DESC;
