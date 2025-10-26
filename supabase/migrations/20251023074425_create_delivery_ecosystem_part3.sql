-- Wasalni Delivery Ecosystem - Part 3: Communication, Financial, and Support
--
-- Tables Created:
-- 1. chat_conversations - Chat sessions between customers and drivers
-- 2. chat_messages - Individual chat messages
-- 3. transactions - Financial transaction tracking
-- 4. commission_rules - Platform commission configuration
-- 5. reviews - Customer reviews for drivers and merchants
-- 6. notifications - Push notification log
-- 7. support_tickets - Customer support system

CREATE TYPE message_type_enum AS ENUM ('text', 'image', 'location');
CREATE TYPE transaction_type_enum AS ENUM ('order_payment', 'driver_payout', 'merchant_settlement', 'refund', 'commission');
CREATE TYPE transaction_status_enum AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE reviewee_type_enum AS ENUM ('driver', 'merchant');
CREATE TYPE ticket_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE ticket_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');

-- 1. Chat Conversations
CREATE TABLE IF NOT EXISTS chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES profiles(id),
  driver_id uuid NOT NULL REFERENCES profiles(id),
  last_message text,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
  ON chat_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_id OR auth.uid() = driver_id);

CREATE POLICY "Customers can create conversations for their orders"
  ON chat_conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = chat_conversations.order_id
      AND orders.customer_id = auth.uid()
    )
  );

-- 2. Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id),
  message_text text NOT NULL,
  message_type message_type_enum DEFAULT 'text',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conversation participants can view messages"
  ON chat_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.customer_id = auth.uid() OR chat_conversations.driver_id = auth.uid())
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_conversations
      WHERE chat_conversations.id = chat_messages.conversation_id
      AND (chat_conversations.customer_id = auth.uid() OR chat_conversations.driver_id = auth.uid())
    )
    AND auth.uid() = sender_id
  );

-- 3. Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type transaction_type_enum NOT NULL,
  reference_id uuid,
  user_id uuid REFERENCES profiles(id),
  amount numeric(10, 2) NOT NULL,
  currency text DEFAULT 'SAR',
  status transaction_status_enum DEFAULT 'pending',
  payment_method text,
  description text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. Commission Rules
CREATE TABLE IF NOT EXISTS commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_category text NOT NULL,
  commission_percentage numeric(5, 2) DEFAULT 0,
  commission_fixed numeric(10, 2) DEFAULT 0,
  min_commission numeric(10, 2),
  max_commission numeric(10, 2),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active commission rules"
  ON commission_rules FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 5. Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id),
  reviewer_id uuid NOT NULL REFERENCES profiles(id),
  reviewee_id uuid NOT NULL REFERENCES profiles(id),
  reviewee_type reviewee_type_enum NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reviews about them"
  ON reviews FOR SELECT
  TO authenticated
  USING (auth.uid() = reviewee_id OR auth.uid() = reviewer_id);

CREATE POLICY "Customers can create reviews"
  ON reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reviewer_id);

-- 6. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title_ar text NOT NULL,
  title_en text,
  body_ar text NOT NULL,
  body_en text,
  notification_type text,
  reference_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 7. Support Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number text UNIQUE NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id),
  subject text NOT NULL,
  description text NOT NULL,
  status ticket_status_enum DEFAULT 'open',
  priority ticket_priority_enum DEFAULT 'medium',
  assigned_to uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_chat_conversations_order ON chat_conversations(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);