-- Script to add INSERT policy for chat_conversations table
-- This script should be run in the Supabase SQL editor

-- Add INSERT policy for chat_conversations
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