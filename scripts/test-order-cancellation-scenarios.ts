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

// حالات الطلب القابلة للإلغاء
const CANCELLABLE_STATUSES = ['pending', 'accepted', 'preparing', 'ready'];

async function testOrderCancellationScenarios() {
  console.log('Testing order cancellation scenarios...\n');

  try {
    // اختبار إلغاء الطلبات في حالات مختلفة
    for (const status of CANCELLABLE_STATUSES) {
      console.log(`Testing cancellation for status: ${status}`);
      
      // إنشاء طلب بحالة محددة
      const orderId = await createTestOrderWithStatus(status);
      
      if (orderId) {
        // محاولة إلغاء الطلب
        const result = await cancelOrder(orderId);
        
        if (result) {
          console.log(`✅ Successfully cancelled order with status: ${status}`);
        } else {
          console.log(`❌ Failed to cancel order with status: ${status}`);
        }
      }
      
      console.log('---');
    }
    
    // اختبار محاولة إلغاء طلب قيد التوصيل (يجب أن يفشل)
    console.log('Testing cancellation for "on_the_way" status (should fail):');
    const onTheWayOrderId = await createTestOrderWithStatus('on_the_way');
    
    if (onTheWayOrderId) {
      const result = await cancelOrder(onTheWayOrderId);
      
      if (!result) {
        console.log('✅ Correctly prevented cancellation of "on_the_way" order');
      } else {
        console.log('❌ Incorrectly allowed cancellation of "on_the_way" order');
      }
    }
    
    console.log('\n🎉 All order cancellation tests completed!');
  } catch (error) {
    console.error('Unexpected error during order cancellation tests:', error);
  }
}

async function createTestOrderWithStatus(status: string): Promise<string | null> {
  try {
    // الحصول على أول تاجر من قاعدة البيانات
    const { data: merchants, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .limit(1);

    if (merchantError) {
      console.error('Error fetching merchant:', merchantError);
      return null;
    }

    if (!merchants || merchants.length === 0) {
      console.error('No merchants found.');
      return null;
    }

    const merchantId = merchants[0].id;
    
    // الحصول على أول مستخدم من قاعدة البيانات
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (userError) {
      console.error('Error fetching user:', userError);
      return null;
    }

    if (!users || users.length === 0) {
      console.error('No users found.');
      return null;
    }

    const userId = users[0].id;

    // إنشاء طلب تجريبي
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: `TEST-${status}-${Date.now()}`,
        customer_id: userId,
        merchant_id: merchantId,
        status: status,
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
      return null;
    }

    console.log(`  Created test order with status "${status}": ${order.order_number}`);
    return order.id;
  } catch (error) {
    console.error('Error creating test order:', error);
    return null;
  }
}

async function cancelOrder(orderId: string): Promise<boolean> {
  try {
    // التحقق من حالة الطلب الحالية
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (fetchError) {
      console.error('Error fetching order:', fetchError);
      return false;
    }

    console.log(`  Current status: ${order.status}`);

    // محاولة إلغاء الطلب
    const { error: cancelError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (cancelError) {
      console.error('  Error cancelling order:', cancelError);
      return false;
    }

    // التحقق من حالة الطلب بعد الإلغاء
    const { data: updatedOrder, error: checkError } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (checkError) {
      console.error('  Error checking updated order:', checkError);
      return false;
    }

    console.log(`  Updated status: ${updatedOrder.status}`);
    
    return updatedOrder.status === 'cancelled';
  } catch (error) {
    console.error('Error during order cancellation:', error);
    return false;
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('test-order-cancellation-scenarios.ts');
if (isMainModule) {
  testOrderCancellationScenarios();
}