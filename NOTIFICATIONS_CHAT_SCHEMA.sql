-- ============================================
-- نظام الإشعارات والدردشة - Supabase Schema (مرتّب ومُراجع)
-- ============================================

-- 🔔 جدول Push Tokens للإشعارات
-- ============================================
CREATE TABLE IF NOT EXISTS push_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    device_type TEXT CHECK (device_type IN ('ios', 'android', 'web')),
    device_name TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_active ON push_tokens(is_active) WHERE is_active = true;

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tokens"
    ON push_tokens FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tokens"
    ON push_tokens FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tokens"
    ON push_tokens FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
    ON push_tokens FOR DELETE
    USING (auth.uid() = user_id);


-- 🔔 جدول الإشعارات
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    type TEXT CHECK (type IN ('order', 'message', 'system', 'promotion', 'review', 'status_update')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);


-- 💬 جدول المحادثات (Conversations)
-- ============================================
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT CHECK (type IN ('customer_merchant', 'customer_driver', 'merchant_driver', 'support')) NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    last_message TEXT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_order_id ON conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;


-- 💬 جدول المشاركين في المحادثات
-- ============================================
CREATE TABLE IF NOT EXISTS conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT CHECK (role IN ('customer', 'merchant', 'driver', 'support')) NOT NULL,
    unread_count INTEGER DEFAULT 0,
    last_read_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(conversation_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversation_participants_conversation_id ON conversation_participants(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id ON conversation_participants(user_id);

-- RLS Policies
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own participations"
    ON conversation_participants FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert participations"
    ON conversation_participants FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participations"
    ON conversation_participants FOR UPDATE
    USING (auth.uid() = user_id);


-- 💬 جدول الرسائل
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    type TEXT CHECK (type IN ('text', 'image', 'location', 'order_update')) DEFAULT 'text',
    metadata JSONB DEFAULT '{}',
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

-- RLS Policies
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
    ON messages FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in their conversations"
    ON messages FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND
        EXISTS (
            SELECT 1 FROM conversation_participants
            WHERE conversation_id = messages.conversation_id
            AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own messages"
    ON messages FOR UPDATE
    USING (auth.uid() = sender_id);


-- ⚡ Functions للتحديثات التلقائية
-- ============================================

-- تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger لجدول push_tokens
DROP TRIGGER IF EXISTS update_push_tokens_updated_at ON push_tokens;
CREATE TRIGGER update_push_tokens_updated_at
    BEFORE UPDATE ON push_tokens
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger لجدول conversations
DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- تحديث المحادثة عند إضافة رسالة جديدة
CREATE OR REPLACE FUNCTION update_conversation_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
    -- تحديث آخر رسالة ووقتها
    UPDATE conversations
    SET 
        last_message = NEW.content,
        last_message_at = NEW.created_at,
        updated_at = NEW.created_at
    WHERE id = NEW.conversation_id;
    
    -- زيادة عدد الرسائل غير المقروءة للمشاركين (ما عدا المرسل)
    UPDATE conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
    AND user_id != NEW.sender_id;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_update_conversation_on_new_message ON messages;
CREATE TRIGGER trigger_update_conversation_on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION update_conversation_on_new_message();


-- تصفير عدد الرسائل غير المقروءة عند القراءة
CREATE OR REPLACE FUNCTION reset_unread_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_read_at > OLD.last_read_at OR OLD.last_read_at IS NULL THEN
        NEW.unread_count = 0;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trigger_reset_unread_count ON conversation_participants;
CREATE TRIGGER trigger_reset_unread_count
    BEFORE UPDATE ON conversation_participants
    FOR EACH ROW
    EXECUTE FUNCTION reset_unread_count();


-- ⚡ Function لإنشاء محادثة مع المشاركين
-- ============================================
CREATE OR REPLACE FUNCTION create_conversation_with_participants(
    p_type TEXT,
    p_order_id UUID,
    p_participant_ids UUID[],
    p_participant_roles TEXT[]
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_participant_id UUID;
    v_participant_role TEXT;
    v_index INTEGER;
BEGIN
    -- إنشاء المحادثة
    INSERT INTO conversations (type, order_id)
    VALUES (p_type, p_order_id)
    RETURNING id INTO v_conversation_id;
    
    -- إضافة المشاركين
    FOR v_index IN 1..array_length(p_participant_ids, 1)
    LOOP
        v_participant_id := p_participant_ids[v_index];
        v_participant_role := p_participant_roles[v_index];
        
        INSERT INTO conversation_participants (conversation_id, user_id, role)
        VALUES (v_conversation_id, v_participant_id, v_participant_role);
    END LOOP;
    
    RETURN v_conversation_id;
END;
$$ language 'plpgsql';


-- ⚡ Function للبحث عن أو إنشاء محادثة
-- ============================================
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_type TEXT,
    p_order_id UUID,
    p_user1_id UUID,
    p_user1_role TEXT,
    p_user2_id UUID,
    p_user2_role TEXT
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
BEGIN
    -- البحث عن محادثة موجودة
    SELECT c.id INTO v_conversation_id
    FROM conversations c
    WHERE c.type = p_type
    AND (c.order_id = p_order_id OR (c.order_id IS NULL AND p_order_id IS NULL))
    AND EXISTS (
        SELECT 1 FROM conversation_participants cp1
        WHERE cp1.conversation_id = c.id
        AND cp1.user_id = p_user1_id
    )
    AND EXISTS (
        SELECT 1 FROM conversation_participants cp2
        WHERE cp2.conversation_id = c.id
        AND cp2.user_id = p_user2_id
    )
    LIMIT 1;
    
    -- إذا لم توجد، أنشئها
    IF v_conversation_id IS NULL THEN
        v_conversation_id := create_conversation_with_participants(
            p_type,
            p_order_id,
            ARRAY[p_user1_id, p_user2_id],
            ARRAY[p_user1_role, p_user2_role]
        );
    END IF;
    
    RETURN v_conversation_id;
END;
$$ language 'plpgsql';


-- ⚡ Views للاستعلامات السريعة
-- ============================================

-- View لعرض المحادثات مع تفاصيل المشاركين
CREATE OR REPLACE VIEW conversation_details AS
SELECT 
    c.id,
    c.type,
    c.order_id,
    c.last_message,
    c.last_message_at,
    c.created_at,
    c.updated_at,
    json_agg(
        json_build_object(
            'user_id', cp.user_id,
            'role', cp.role,
            'unread_count', cp.unread_count,
            'last_read_at', cp.last_read_at
        )
    ) as participants
FROM conversations c
JOIN conversation_participants cp ON cp.conversation_id = c.id
GROUP BY c.id, c.type, c.order_id, c.last_message, c.last_message_at, c.created_at, c.updated_at;


-- ✅ تفعيل Realtime للجداول
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;


-- ✅ منح الصلاحيات
-- ============================================
GRANT ALL ON push_tokens TO authenticated;
GRANT ALL ON notifications TO authenticated;
GRANT ALL ON conversations TO authenticated;
GRANT ALL ON conversation_participants TO authenticated;
GRANT ALL ON messages TO authenticated;

-- ============================================
-- 🚀 نظام إرسال الإشعارات التلقائي
-- ============================================

-- جدول لتجميع الأحداث التي تحتاج إرسال إشعار
CREATE TABLE IF NOT EXISTS pending_push_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT CHECK (event_type IN ('new_message', 'new_notification')) NOT NULL,
    target_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    is_sent BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_push_events_sent ON pending_push_events(is_sent);
CREATE INDEX IF NOT EXISTS idx_pending_push_events_user_id ON pending_push_events(target_user_id);


-- ✅ Trigger عند إدخال رسالة جديدة
CREATE OR REPLACE FUNCTION add_push_event_on_new_message()
RETURNS TRIGGER AS $$
DECLARE
    participant RECORD;
BEGIN
    -- لكل المشاركين في المحادثة غير المرسل
    FOR participant IN
        SELECT user_id
        FROM conversation_participants
        WHERE conversation_id = NEW.conversation_id
        AND user_id != NEW.sender_id
    LOOP
        INSERT INTO pending_push_events (event_type, target_user_id, payload)
        VALUES (
            'new_message',
            participant.user_id,
            jsonb_build_object(
                'conversation_id', NEW.conversation_id,
                'sender_id', NEW.sender_id,
                'content', NEW.content,
                'created_at', NEW.created_at
            )
        );
    END LOOP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_add_push_event_on_new_message ON messages;
CREATE TRIGGER trigger_add_push_event_on_new_message
    AFTER INSERT ON messages
    FOR EACH ROW
    EXECUTE FUNCTION add_push_event_on_new_message();


-- ✅ Trigger عند إدخال إشعار جديد
CREATE OR REPLACE FUNCTION add_push_event_on_new_notification()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO pending_push_events (event_type, target_user_id, payload)
    VALUES (
        'new_notification',
        NEW.user_id,
        jsonb_build_object(
            'title', NEW.title,
            'body', NEW.body,
            'type', NEW.type,
            'created_at', NEW.created_at
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_add_push_event_on_new_notification ON notifications;
CREATE TRIGGER trigger_add_push_event_on_new_notification
    AFTER INSERT ON notifications
    FOR EACH ROW
    EXECUTE FUNCTION add_push_event_on_new_notification();

-- ✅ منح الصلاحيات
GRANT ALL ON pending_push_events TO authenticated;
ALTER TABLE pending_push_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own push events"
    ON pending_push_events FOR SELECT
    USING (auth.uid() = target_user_id);


-- ✅ نهاية الملف
-- ============================================
-- لتطبيق الملف:
-- psql -h [YOUR_SUPABASE_HOST] -U postgres -d postgres -f NOTIFICATIONS_CHAT_SCHEMA.sql
