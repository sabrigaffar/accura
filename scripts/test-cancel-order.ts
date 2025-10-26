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

async function testCancelOrder() {
  console.log('Testing order cancellation...');

  try {
    // الحصول على طلب قيد الانتظار
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status')
      .eq('status', 'pending')
      .limit(1);

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return;
    }

    if (!orders || orders.length === 0) {
      console.log('No pending orders found. Creating a test order...');
      
      // إنشاء طلب تجريبي إذا لم يكن هناك طلبات قيد الانتظار
      await createTestOrder();
      return;
    }

    const order = orders[0];
    console.log('Order to cancel:', order.order_number);
    console.log('Current status:', order.status);

    // إلغاء الطلب
    const { error: cancelError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (cancelError) {
      console.error('Error cancelling order:', cancelError);
      return;
    }

    console.log('Order cancelled successfully!');
    console.log('Order ID:', order.id);
    console.log('Order Number:', order.order_number);
    
    // التحقق من حالة الطلب بعد الإلغاء
    const { data: updatedOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', order.id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated order:', fetchError);
      return;
    }

    console.log('Updated status:', updatedOrder.status);
    
    if (updatedOrder.status === 'cancelled') {
      console.log('✅ Order cancellation test passed!');
    } else {
      console.log('❌ Order cancellation test failed!');
    }
  } catch (error) {
    console.error('Unexpected error during order cancellation test:', error);
  }
}

async function createTestOrder() {
  try {
    // الحصول على أول تاجر من قاعدة البيانات
    const { data: merchants, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .limit(1);

    if (merchantError) {
      console.error('Error fetching merchant:', merchantError);
      return;
    }

    if (!merchants || merchants.length === 0) {
      console.error('No merchants found.');
      return;
    }

    const merchantId = merchants[0].id;
    
    // الحصول على أول مستخدم من قاعدة البيانات
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (userError) {
      console.error('Error fetching user:', userError);
      return;
    }

    if (!users || users.length === 0) {
      console.error('No users found.');
      return;
    }

    const userId = users[0].id;

    // إنشاء طلب تجريبي
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: `TEST-${Date.now()}`,
        customer_id: userId,
        merchant_id: merchantId,
        status: 'pending',
        subtotal: 50.00,
        delivery_fee: 10.00,
        service_fee: 2.50,
        tax: 1.50,
        discount: 0.00,
        total: 64.00,
        payment_method: 'cash',
        payment_status: 'pending',
      })
      .select()
      .single();

    if (orderError) {
      console.error('Error creating test order:', orderError);
      return;
    }

    console.log('Test order created successfully!');
    console.log('Order ID:', order.id);
    console.log('Order Number:', order.order_number);
    
    // الآن اختبار إلغاء الطلب
    const { error: cancelError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (cancelError) {
      console.error('Error cancelling order:', cancelError);
      return;
    }

    console.log('Test order cancelled successfully!');
    
    // التحقق من حالة الطلب بعد الإلغاء
    const { data: updatedOrder, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', order.id)
      .single();

    if (fetchError) {
      console.error('Error fetching updated order:', fetchError);
      return;
    }

    console.log('Updated status:', updatedOrder.status);
    
    if (updatedOrder.status === 'cancelled') {
      console.log('✅ Order cancellation test passed!');
    } else {
      console.log('❌ Order cancellation test failed!');
    }
  } catch (error) {
    console.error('Unexpected error during test order creation:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('test-cancel-order.ts');
if (isMainModule) {
  testCancelOrder();
}