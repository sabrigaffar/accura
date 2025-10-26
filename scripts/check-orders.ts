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

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  customer_id: string;
  merchant?: {
    name_ar: string;
  }[];
}

async function checkOrders() {
  console.log('Checking orders in database...');

  try {
    // الحصول على جميع الطلبات
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        status,
        total,
        created_at,
        customer_id,
        merchant:merchants(name_ar)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }

    console.log('Found', orders.length, 'orders:');
    
    if (orders.length === 0) {
      console.log('No orders found in database.');
      return;
    }

    orders.forEach((order: any) => {
      console.log('----------------------------------------');
      console.log('Order ID:', order.id);
      console.log('Order Number:', order.order_number);
      console.log('Status:', order.status);
      console.log('Total:', order.total);
      console.log('Created At:', new Date(order.created_at).toLocaleString('ar-SA'));
      console.log('Merchant:', order.merchant && order.merchant.length > 0 ? order.merchant[0].name_ar : 'Unknown');
      console.log('Customer ID:', order.customer_id);
    });
  } catch (error) {
    console.error('Unexpected error during order check:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('check-orders.ts');
if (isMainModule) {
  checkOrders();
}