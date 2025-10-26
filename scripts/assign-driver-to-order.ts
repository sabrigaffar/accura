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

async function assignDriverToOrder() {
  console.log('Assigning driver to order...');

  try {
    // الحصول على الطلب المعلق (ORD-9692)
    const { data: orders, error: ordersError } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', 'ORD-9692');

    if (ordersError) {
      console.error('Error fetching order:', ordersError);
      return;
    }

    if (!orders || orders.length === 0) {
      console.error('Order ORD-9692 not found.');
      return;
    }

    const orderId = orders[0].id;
    console.log('Order ID:', orderId);

    // الحصول على السائق
    const { data: drivers, error: driversError } = await supabase
      .from('driver_profiles')
      .select('id')
      .limit(1);

    if (driversError) {
      console.error('Error fetching driver:', driversError);
      return;
    }

    if (!drivers || drivers.length === 0) {
      console.error('No drivers found.');
      return;
    }

    const driverId = drivers[0].id;
    console.log('Driver ID:', driverId);

    // تعيين السائق للطلب
    const { error: assignError } = await supabase
      .from('orders')
      .update({ 
        driver_id: driverId,
        status: 'accepted'
      })
      .eq('id', orderId);

    if (assignError) {
      console.error('Error assigning driver to order:', assignError);
      return;
    }

    console.log('Driver assigned to order successfully!');
    console.log('Order ID:', orderId);
    console.log('Driver ID:', driverId);
    console.log('Order status updated to accepted.');
  } catch (error) {
    console.error('Unexpected error during driver assignment:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('assign-driver-to-order.ts');
if (isMainModule) {
  assignDriverToOrder();
}