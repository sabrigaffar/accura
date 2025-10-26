import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// تحميل متغيرات البيئة من ملف .env
dotenv.config();

// استخدام المتغيرات البيئية
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'your_supabase_url_here';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'your_supabase_anon_key_here';

console.log('SUPABASE_URL:', SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function createTestUser() {
  console.log('إنشاء مستخدم تجريبي...');

  try {
    // تسجيل مستخدم تجريبي
    const { data, error } = await supabase.auth.signUp({
      phone: '+966501234567',
      password: 'Test123456',
      options: {
        data: {
          full_name: 'مستخدم تجريبي',
          phone_number: '+966501234567',
        }
      }
    });

    if (error) {
      console.error('خطأ في إنشاء المستخدم:', error);
      return;
    }

    console.log('تم إنشاء المستخدم بنجاح:', data.user?.id);
    
    // إنشاء سجل في جدول profiles
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user?.id,
        full_name: 'مستخدم تجريبي',
        phone_number: '+966501234567',
        user_type: 'customer',
        language: 'ar',
        is_active: true,
      });

    if (profileError) {
      console.error('خطأ في إنشاء الملف الشخصي:', profileError);
    } else {
      console.log('تم إنشاء الملف الشخصي بنجاح');
    }

    console.log('تم إنشاء المستخدم التجريبي بنجاح!');
  } catch (error: any) {
    console.error('خطأ في إنشاء المستخدم التجريبي:', error.message);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('create-test-user.ts');
if (isMainModule) {
  createTestUser();
}