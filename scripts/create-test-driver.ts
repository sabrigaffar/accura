import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// استخدام المتغيرات البيئية
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your_supabase_url_here';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your_supabase_service_role_key_here';

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY);

// استخدام service role key لإنشاء عميل Supabase (يتجاوز سياسات RLS)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createTestDriver() {
  console.log('Creating a test driver...');

  try {
    // إنشاء معرف UUID للمستخدم
    const userId = uuidv4();
    
    // إدراج ملف تعريف مستخدم سائق تجريبي في جدول profiles
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        user_type: 'driver',
        full_name: 'سائق تجريبي',
        phone_number: '+966551234567',
        language: 'ar',
        is_active: true,
      })
      .select();

    if (profileError) {
      console.error('Error creating driver profile:', profileError);
      return;
    }

    console.log('Created driver profile with ID:', profileData[0].id);

    // إدراج معلومات السائق في جدول driver_profiles
    const { error: driverError } = await supabase
      .from('driver_profiles')
      .insert({
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
      });

    if (driverError) {
      console.error('Error creating driver info:', driverError);
      return;
    }

    console.log('Created driver info successfully!');
    console.log('Test driver created successfully!');
    console.log('Driver ID:', userId);
    console.log('Phone number: +966551234567');
    console.log('You can now test the driver assignment feature.');
  } catch (error) {
    console.error('Unexpected error during driver creation:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('create-test-driver.ts');
if (isMainModule) {
  createTestDriver();
}