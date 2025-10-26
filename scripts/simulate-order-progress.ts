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

// تسلسل حالات الطلب
const ORDER_STATUS_SEQUENCE = [
  'pending',
  'accepted',
  'preparing',
  'ready',
  'picked_up',
  'on_the_way',
  'delivered'
];

async function simulateOrderProgress() {
  console.log('Simulating order progress...');

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

    const order = orderData[0];
    const currentStatusIndex = ORDER_STATUS_SEQUENCE.indexOf(order.status);
    
    if (currentStatusIndex === -1) {
      console.error('Unknown order status:', order.status);
      return;
    }

    if (currentStatusIndex >= ORDER_STATUS_SEQUENCE.length - 1) {
      console.log('Order is already delivered. Starting from pending again.');
    }

    const nextStatusIndex = (currentStatusIndex + 1) % ORDER_STATUS_SEQUENCE.length;
    const newStatus = ORDER_STATUS_SEQUENCE[nextStatusIndex];

    console.log('Order:', order.order_number);
    console.log('Current status:', order.status);
    console.log('Updating to status:', newStatus);

    // تحديث حالة الطلب
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateError) {
      console.error('Error updating order status:', updateError);
      return;
    }

    console.log('Order status updated successfully!');
    
    // إذا كانت الحالة الجديدة "في الطريق" نضيف وقت التسليم المتوقع
    if (newStatus === 'on_the_way') {
      const estimatedDeliveryTime = new Date();
      estimatedDeliveryTime.setMinutes(estimatedDeliveryTime.getMinutes() + 30);
      
      const { error: timeUpdateError } = await supabase
        .from('orders')
        .update({ 
          estimated_delivery_time: estimatedDeliveryTime.toISOString()
        })
        .eq('id', order.id);
        
      if (timeUpdateError) {
        console.error('Error updating estimated delivery time:', timeUpdateError);
      } else {
        console.log('Estimated delivery time set to:', estimatedDeliveryTime.toLocaleString('ar-SA'));
      }
    }
    
    // إذا كانت الحالة الجديدة "تم التوصيل" نضيف وقت التسليم الفعلي
    if (newStatus === 'delivered') {
      const { error: timeUpdateError } = await supabase
        .from('orders')
        .update({ 
          actual_delivery_time: new Date().toISOString()
        })
        .eq('id', order.id);
        
      if (timeUpdateError) {
        console.error('Error updating actual delivery time:', timeUpdateError);
      } else {
        console.log('Actual delivery time set to:', new Date().toLocaleString('ar-SA'));
      }
    }
  } catch (error) {
    console.error('Unexpected error during order simulation:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('simulate-order-progress.ts');
if (isMainModule) {
  simulateOrderProgress();
}