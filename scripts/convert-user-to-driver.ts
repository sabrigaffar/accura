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

async function convertUserToDriver() {
  console.log('Converting user to driver...');

  try {
    // الحصول على المستخدم "مستخدم تجريبي"
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('full_name', 'مستخدم تجريبي');

    if (usersError) {
      console.error('Error fetching user:', usersError);
      return;
    }

    if (!users || users.length === 0) {
      console.error('User "مستخدم تجريبي" not found.');
      return;
    }

    const userId = users[0].id;
    console.log('User ID:', userId);

    // تحديث نوع المستخدم إلى سائق
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        user_type: 'driver',
        updated_at: new Date().toISOString()
      })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user type:', updateError);
      return;
    }

    console.log('Updated user type to driver.');

    // إنشاء سجل في جدول driver_profiles
    const { error: driverError } = await supabase
      .from('driver_profiles')
      .upsert({
        id: userId,
        vehicle_type: 'car',
        vehicle_model: 'تويوتا كامري',
        vehicle_color: 'أبيض',
        license_plate: 'أب1234',
        is_verified: true,
        is_online: true,
        total_earnings: 0,
        total_deliveries: 0,
        average_rating: 4.5,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'id'
      });

    if (driverError) {
      console.error('Error creating driver profile:', driverError);
      return;
    }

    console.log('Created driver profile successfully!');
    console.log('User converted to driver successfully!');
    console.log('Driver ID:', userId);
    console.log('You can now test the driver assignment feature.');
  } catch (error) {
    console.error('Unexpected error during user conversion:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('convert-user-to-driver.ts');
if (isMainModule) {
  convertUserToDriver();
}