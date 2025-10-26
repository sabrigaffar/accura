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

interface Profile {
  full_name: string;
  phone_number: string;
}

interface Driver {
  id: string;
  vehicle_type: string;
  vehicle_model: string;
  is_verified: boolean;
  is_online: boolean;
  total_deliveries: number;
  average_rating: number;
  profiles: Profile | Profile[];
}

async function listDrivers() {
  console.log('Listing drivers in database...');

  try {
    // جلب معلومات السائقين مع ملفات التعريف
    const { data, error } = await supabase
      .from('driver_profiles')
      .select(`
        id,
        vehicle_type,
        vehicle_model,
        is_verified,
        is_online,
        total_deliveries,
        average_rating,
        profiles (
          full_name,
          phone_number
        )
      `);

    if (error) {
      console.error('Error fetching drivers:', error);
      return;
    }

    console.log('Found', data.length, 'drivers:');
    
    if (data.length === 0) {
      console.log('No drivers found in database.');
      return;
    }

    data.forEach((driver: Driver) => {
      // Handle the case where profiles might be an array
      const profile = Array.isArray(driver.profiles) 
        ? driver.profiles[0] 
        : driver.profiles;
        
      console.log('----------------------------------------');
      console.log('Driver ID:', driver.id);
      console.log('Full Name:', profile?.full_name || 'Unknown');
      console.log('Phone Number:', profile?.phone_number || 'Unknown');
      console.log('Vehicle Type:', driver.vehicle_type);
      console.log('Vehicle Model:', driver.vehicle_model || 'Not specified');
      console.log('Verified:', driver.is_verified ? 'Yes' : 'No');
      console.log('Online:', driver.is_online ? 'Yes' : 'No');
      console.log('Total Deliveries:', driver.total_deliveries);
      console.log('Average Rating:', driver.average_rating);
    });
  } catch (error) {
    console.error('Unexpected error during driver listing:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('list-drivers.ts');
if (isMainModule) {
  listDrivers();
}