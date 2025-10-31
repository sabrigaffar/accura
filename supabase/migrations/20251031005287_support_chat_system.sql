-- نظام الدعم الفني - Support Chat System
-- محادثة فورية بين المستخدمين وفريق الدعم

-- ==============================================
-- 1. إنشاء جدول رسائل الدعم
-- ==============================================

CREATE TABLE IF NOT EXISTS support_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  sender_type TEXT NOT NULL CHECK (sender_type IN ('user', 'support')),
  message_text TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file')),
  attachment_url TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes للأداء
CREATE INDEX IF NOT EXISTS idx_support_chat_messages_ticket ON support_chat_messages(ticket_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_chat_messages_unread ON support_chat_messages(ticket_id, is_read) WHERE is_read = false;

-- ==============================================
-- 2. تحديث جدول support_tickets لإضافة آخر رسالة
-- ==============================================

ALTER TABLE support_tickets
ADD COLUMN IF NOT EXISTS last_message TEXT,
ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unread_count INTEGER DEFAULT 0;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_status ON support_tickets(user_id, status);

-- ==============================================
-- 3. دالة لتحديث آخر رسالة في التذكرة
-- ==============================================

CREATE OR REPLACE FUNCTION update_ticket_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE support_tickets
  SET 
    last_message = NEW.message_text,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$;

-- Trigger لتحديث آخر رسالة تلقائياً
DROP TRIGGER IF EXISTS trigger_update_ticket_last_message ON support_chat_messages;
CREATE TRIGGER trigger_update_ticket_last_message
  AFTER INSERT ON support_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_last_message();

-- ==============================================
-- 4. دالة لحساب عدد الرسائل غير المقروءة
-- ==============================================

CREATE OR REPLACE FUNCTION update_ticket_unread_count()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  unread_count INTEGER;
  ticket_user_id UUID;
BEGIN
  -- جلب صاحب التذكرة
  SELECT user_id INTO ticket_user_id
  FROM support_tickets
  WHERE id = NEW.ticket_id;
  
  -- حساب الرسائل غير المقروءة من الدعم فقط
  SELECT COUNT(*)
  INTO unread_count
  FROM support_chat_messages
  WHERE ticket_id = NEW.ticket_id
    AND is_read = false
    AND sender_type = 'support';
  
  -- تحديث العدد
  UPDATE support_tickets
  SET unread_count = unread_count
  WHERE id = NEW.ticket_id;
  
  RETURN NEW;
END;
$$;

-- Trigger لتحديث عدد غير المقروءة
DROP TRIGGER IF EXISTS trigger_update_unread_count ON support_chat_messages;
CREATE TRIGGER trigger_update_unread_count
  AFTER INSERT OR UPDATE ON support_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_unread_count();

-- ==============================================
-- 5. RLS Policies
-- ==============================================

ALTER TABLE support_chat_messages ENABLE ROW LEVEL SECURITY;

-- المستخدمون يمكنهم رؤية رسائل تذاكرهم فقط
DROP POLICY IF EXISTS "Users can view their ticket messages" ON support_chat_messages;
CREATE POLICY "Users can view their ticket messages"
ON support_chat_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_chat_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
  )
);

-- المستخدمون يمكنهم إرسال رسائل لتذاكرهم
DROP POLICY IF EXISTS "Users can send messages to their tickets" ON support_chat_messages;
CREATE POLICY "Users can send messages to their tickets"
ON support_chat_messages FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_chat_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
  )
  AND sender_id = auth.uid()
  AND sender_type = 'user'
);

-- المستخدمون يمكنهم تحديث حالة القراءة لرسائلهم
DROP POLICY IF EXISTS "Users can mark messages as read" ON support_chat_messages;
CREATE POLICY "Users can mark messages as read"
ON support_chat_messages FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_chat_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_chat_messages.ticket_id
      AND support_tickets.user_id = auth.uid()
  )
);

-- ==============================================
-- 6. Views للإحصائيات
-- ==============================================

CREATE OR REPLACE VIEW support_tickets_with_stats AS
SELECT 
  st.*,
  p.full_name as user_name,
  p.user_type,
  COUNT(scm.id) as total_messages,
  COUNT(CASE WHEN scm.is_read = false AND scm.sender_type = 'support' THEN 1 END) as unread_messages
FROM support_tickets st
JOIN profiles p ON p.id = st.user_id
LEFT JOIN support_chat_messages scm ON scm.ticket_id = st.id
GROUP BY st.id, p.full_name, p.user_type;

COMMENT ON VIEW support_tickets_with_stats IS 'تذاكر الدعم مع إحصائيات الرسائل';

-- ==============================================
-- 7. تعليقات ووصف
-- ==============================================

COMMENT ON TABLE support_chat_messages IS 'رسائل المحادثة في تذاكر الدعم الفني';
COMMENT ON COLUMN support_chat_messages.sender_type IS 'نوع المرسل: user (مستخدم) أو support (دعم فني)';
COMMENT ON COLUMN support_chat_messages.message_type IS 'نوع الرسالة: text, image, file';
COMMENT ON COLUMN support_chat_messages.is_read IS 'هل تم قراءة الرسالة';

COMMENT ON COLUMN support_tickets.last_message IS 'آخر رسالة في التذكرة';
COMMENT ON COLUMN support_tickets.last_message_at IS 'وقت آخر رسالة';
COMMENT ON COLUMN support_tickets.unread_count IS 'عدد الرسائل غير المقروءة';

-- ==============================================
-- 8. Enable Realtime
-- ==============================================

-- تفعيل Realtime للرسائل الفورية
ALTER PUBLICATION supabase_realtime ADD TABLE support_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;

-- ==============================================
-- 9. رسالة نجاح
-- ==============================================

DO $$
BEGIN
  RAISE NOTICE '✅ تم إنشاء نظام الدعم الفني بنجاح!';
  RAISE NOTICE '✅ جدول support_chat_messages جاهز';
  RAISE NOTICE '✅ Triggers للتحديث التلقائي';
  RAISE NOTICE '✅ RLS Policies محدثة';
  RAISE NOTICE '✅ Realtime مفعّل';
END $$;
