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

async function updateTestOrder() {
  console.log('Updating test order status...');

  try {
    // الحصول على آخر طلب من قاعدة البيانات
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .order('created_at', { ascending: false })
      .limit(1);

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return;
    }

    if (!orderData || orderData.length === 0) {
      console.error('No order found.');
      return;
    }

    const orderId = orderData[0].id;
    const orderNumber = orderData[0].order_number;
    const currentStatus = orderData[0].status;
    
    console.log('Found order:', orderNumber, 'with current status:', currentStatus);

    // تحديث حالة الطلب
    const statusSequence = [
      'pending',
      'accepted',
      'preparing',
      'ready',
      'picked_up',
      'on_the_way',
      'delivered'
    ];

    const currentIndex = statusSequence.indexOf(currentStatus);
    const nextIndex = (currentIndex + 1) % statusSequence.length;
    const newStatus = statusSequence[nextIndex];

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (updateError) {
      console.error('Error updating order status:', updateError);
      return;
    }

    console.log('Order status updated successfully!');
    console.log('Order:', orderNumber);
    console.log('New status:', newStatus);
  } catch (error) {
    console.error('Unexpected error during order update:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('update-test-order.ts');
if (isMainModule) {
  updateTestOrder();
}