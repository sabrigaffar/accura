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

async function listMessages() {
  console.log('Listing messages in database...');

  try {
    // جلب الرسائل مع معلومات المرسل والمحادثة
    const { data, error } = await supabase
      .from('chat_messages')
      .select(`
        id,
        message_text,
        is_read,
        created_at,
        sender:profiles(full_name),
        conversation:chat_conversations(order:orders(order_number))
      `)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return;
    }

    console.log('Found', data.length, 'messages:');
    
    if (data.length === 0) {
      console.log('No messages found in database.');
      return;
    }

    data.forEach(msg => {
      // Handle the case where sender and conversation might be arrays
      const senderProfile = Array.isArray(msg.sender) ? msg.sender[0] : msg.sender;
      const conversation = Array.isArray(msg.conversation) ? msg.conversation[0] : msg.conversation;
      const order = Array.isArray(conversation?.order) ? conversation.order[0] : conversation?.order;
      
      console.log('----------------------------------------');
      console.log('Message ID:', msg.id);
      console.log('Order Number:', order?.order_number || 'Unknown');
      console.log('Sender:', senderProfile?.full_name || 'Unknown');
      console.log('Message:', msg.message_text);
      console.log('Read:', msg.is_read ? 'Yes' : 'No');
      console.log('Created At:', new Date(msg.created_at).toLocaleString('ar-SA'));
    });
  } catch (error) {
    console.error('Unexpected error during message listing:', error);
  }
}

// تشغيل السكريبت إذا تم استدعاؤه مباشرة
const isMainModule = process.argv[1] && process.argv[1].endsWith('list-messages.ts');
if (isMainModule) {
  listMessages();
}