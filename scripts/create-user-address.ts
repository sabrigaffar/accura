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

async function createUserAddress() {
  console.log('Creating address for current user...');

  try {
    // الحصول على المستخدم الحالي (sabri)
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('full_name', 'sabri');

    if (usersError) {
      console.error('Error fetching user:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.error('User "sabri" not found.');
      return;
    }

    const userId = users[0].id;
    console.log('User ID:', userId);

    // إنشاء عنوان توصيل تجريبي
    const { data: addressData, error: addressError } = await supabase
      .from('addresses')
      .insert({
        user_id: userId,
        title: 'المنزل',
        street_address: 'شارع التسعين',
        city: 'الرياض',
        district: 'النخيل',
        building_number: '456',
        floor_number: '5',
        is_default: true,
      })
      .select();

    if (addressError) {
      console.error('Error creating address:', addressError);
      return;
    }

    console.log('Created address with ID:', addressData[0].id);
    console.log('Address details:');
    console.log('  Title:', addressData[0].title);
    console.log('  Street:', addressData[0].street_address);
    console.log('  City:', addressData[0].city);
  } catch (error) {
    console.error('Unexpected error during address creation:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('create-user-address.ts');
if (isMainModule) {
  createUserAddress();
}