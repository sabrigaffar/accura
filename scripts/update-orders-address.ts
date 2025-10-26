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

async function updateOrdersAddress() {
  console.log('Updating orders to use new address...');

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

    // الحصول على العنوان الجديد
    const { data: addresses, error: addressError } = await supabase
      .from('addresses')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (addressError) {
      console.error('Error fetching address:', addressError);
      return;
    }

    if (!addresses || addresses.length === 0) {
      console.error('No address found for user.');
      return;
    }

    const addressId = addresses[0].id;
    console.log('Address ID:', addressId);

    // تحديث الطلبات لاستخدام العنوان الجديد
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .update({ delivery_address_id: addressId })
      .eq('customer_id', userId)
      .select();

    if (ordersError) {
      console.error('Error updating orders:', ordersError);
      return;
    }

    console.log('Updated', orders.length, 'orders to use new address.');
    
    if (orders.length > 0) {
      orders.forEach(order => {
        console.log('Updated order:', order.order_number);
      });
    }
  } catch (error) {
    console.error('Unexpected error during order update:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('update-orders-address.ts');
if (isMainModule) {
  updateOrdersAddress();
}