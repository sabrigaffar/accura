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

async function sendTestMessage() {
  console.log('Sending test message...');

  try {
    // استخدام معرف المحادثة التي أنشأناها للتو
    const conversationId = '189f8856-ce82-4849-8a7f-98066be7e146';
    
    // الحصول على معلومات المحادثة
    const { data: conversation, error: convError } = await supabase
      .from('chat_conversations')
      .select('customer_id, driver_id')
      .eq('id', conversationId)
      .single();

    if (convError) {
      console.error('Error fetching conversation:', convError);
      return;
    }

    console.log('Conversation ID:', conversationId);

    // إرسال رسالة تجريبية من العميل
    const { error: messageError } = await supabase
      .from('chat_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: conversation.customer_id,
        message_text: 'مرحباً، أين طلبي؟',
        is_read: false,
      });

    if (messageError) {
      console.error('Error sending message:', messageError);
      return;
    }

    console.log('Test message sent successfully!');
    console.log('Message: "مرحباً، أين طلبي؟"');
    
    // إرسال رد تجريبي من السائق
    setTimeout(async () => {
      const { error: replyError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: conversation.driver_id,
          message_text: 'طلبكم قيد التوصيل وسيصل خلال 10 دقائق',
          is_read: false,
        });

      if (replyError) {
        console.error('Error sending reply:', replyError);
        return;
      }

      console.log('Test reply sent successfully!');
      console.log('Reply: "طلبكم قيد التوصيل وسيصل خلال 10 دقائق"');
    }, 2000);
  } catch (error) {
    console.error('Unexpected error during message sending:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('send-test-message.ts');
if (isMainModule) {
  sendTestMessage();
}