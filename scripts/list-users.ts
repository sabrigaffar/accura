import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// استخدام المتغيرات البيئية
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your_supabase_url_here';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here';

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY);

// استخدام service role key لإنشاء عميل Supabase (يتجاوز سياسات RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function listUsers() {
  console.log('Listing users in database...');

  try {
    // الحصول على جميع المستخدمين
    const { data: users, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return;
    }

    console.log('Found', users.length, 'users:');
    
    if (users.length === 0) {
      console.log('No users found in database.');
      return;
    }

    users.forEach(user => {
      console.log('----------------------------------------');
      console.log('User ID:', user.id);
      console.log('Full Name:', user.full_name);
      console.log('Phone Number:', user.phone_number);
      console.log('User Type:', user.user_type);
      console.log('Created At:', new Date(user.created_at).toLocaleString('ar-SA'));
    });
  } catch (error) {
    console.error('Unexpected error during user listing:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('list-users.ts');
if (isMainModule) {
  listUsers();
}