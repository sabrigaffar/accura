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

async function createTestConversation() {
  console.log('Creating test conversation...');

  try {
    // الحصول على الطلب المحدد
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id, driver_id')
      .eq('order_number', 'ORD-9692')
      .limit(1);

    if (orderError) {
      console.error('Error fetching order:', orderError);
      return;
    }

    if (!orders || orders.length === 0) {
      console.error('Order ORD-9692 not found.');
      return;
    }

    const order = orders[0];
    console.log('Order ID:', order.id);

    // إنشاء محادثة للطلب
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .insert({
        order_id: order.id,
        customer_id: order.customer_id,
        driver_id: order.driver_id,
      })
      .select()
      .single();

    if (convError) {
      console.error('Error creating conversation:', convError);
      return;
    }

    console.log('Test conversation created successfully!');
    console.log('Conversation ID:', conversation.id);
    console.log('Order ID:', conversation.order_id);
    console.log('Customer ID:', conversation.customer_id);
    console.log('Driver ID:', conversation.driver_id);
  } catch (error) {
    console.error('Unexpected error during conversation creation:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('create-test-conversation.ts');
if (isMainModule) {
  createTestConversation();
}