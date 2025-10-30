-- ============================================
-- إصلاح جدول notifications
-- ============================================

-- حذف الجدول القديم إذا كان موجوداً بدون الأعمدة الصحيحة
DROP TABLE IF EXISTS notifications CASCADE;

-- إنشاء جدول notifications بالبنية الصحيحة
CREATE TABLE notifications (
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

-- Indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_notifications_is_read ON notifications(is_read) WHERE is_read = false;

-- RLS Policies
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
    ON notifications FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
    ON notifications FOR UPDATE
    USING (auth.uid() = user_id);

-- تفعيل Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- منح الصلاحيات
GRANT ALL ON notifications TO authenticated;

-- ✅ الآن جدول notifications جاهز بالبنية الصحيحة!
