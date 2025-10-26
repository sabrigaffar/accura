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

async function checkCurrentUser() {
  console.log('Checking current user...');

  try {
    // الحصول على معلومات المستخدم الحالي
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError) {
      console.error('Error getting current user:', authError);
      return;
    }
    
    if (!user) {
      console.log('No user is currently logged in.');
      return;
    }
    
    console.log('Current user ID:', user.id);
    console.log('Current user phone:', user.phone);
    
    // الحصول على ملف تعريف المستخدم
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
      
    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return;
    }
    
    if (profile) {
      console.log('User profile:');
      console.log('  Full name:', profile.full_name);
      console.log('  User type:', profile.user_type);
      console.log('  Phone number:', profile.phone_number);
    } else {
      console.log('No profile found for current user.');
    }
    
    // الحصول على الطلبات الخاصة بالمستخدم الحالي
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total,
        created_at
      `)
      .eq('customer_id', user.id)
      .order('created_at', { ascending: false });
      
    if (ordersError) {
      console.error('Error fetching user orders:', ordersError);
      return;
    }
    
    console.log('Found', orders.length, 'orders for current user:');
    
    if (orders.length === 0) {
      console.log('No orders found for current user.');
    } else {
      orders.forEach(order => {
        console.log('----------------------------------------');
        console.log('Order ID:', order.id);
        console.log('Order Number:', order.order_number);
        console.log('Status:', order.status);
        console.log('Total:', order.total);
        console.log('Created At:', new Date(order.created_at).toLocaleString('ar-SA'));
      });
    }
  } catch (error) {
    console.error('Unexpected error during user check:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('check-current-user.ts');
if (isMainModule) {
  checkCurrentUser();
}