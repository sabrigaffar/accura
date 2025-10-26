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

async function initDatabase() {
  console.log('جاري تهيئة قاعدة بيانات Supabase...');

  try {
    // 1. إنشاء الجداول
    console.log('إنشاء الجداول...');
    
    // جدول المستخدمين
    const { error: profilesError } = await supabase.rpc('sql', {
      statement: `
        CREATE TABLE IF NOT EXISTS profiles (
          id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
          user_type TEXT NOT NULL DEFAULT 'customer',
          full_name TEXT NOT NULL,
          phone_number TEXT UNIQUE NOT NULL,
          avatar_url TEXT,
          language TEXT DEFAULT 'ar',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });
    
    if (profilesError && !profilesError.message.includes('already exists')) {
      console.error('خطأ في إنشاء جدول المستخدمين:', profilesError);
    } else {
      console.log('تم إنشاء جدول المستخدمين بنجاح!');
    }
    
    // إنشاء فهارس للجدول
    await supabase.rpc('sql', {
      statement: `
        CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
        CREATE INDEX IF NOT EXISTS idx_profiles_phone ON profiles(phone_number);
      `
    });

    console.log('تهيئة قاعدة البيانات مكتملة!');
    console.log('الآن يمكنك:');
    console.log('1. إضافة بيانات تجريبية باستخدام: npm run seed');
    console.log('2. تشغيل التطبيق: npm run dev');

  } catch (error: any) {
    console.error('خطأ في تهيئة قاعدة البيانات:', error.message);
  }
}

// تشغيل التهيئة
initDatabase();