/**
 * أنواع البيانات لنظام الدردشة
 */

export type ConversationType = 
  | 'customer_merchant'
  | 'customer_driver'
  | 'merchant_driver'
  | 'support';

export type MessageType = 'text' | 'image' | 'location' | 'order_update';

export type ParticipantRole = 'customer' | 'merchant' | 'driver' | 'support';

export interface Conversation {
  id: string;
  type: ConversationType;
  order_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: ParticipantRole;
  unread_count: number;
  last_read_at: string | null;
  joined_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  type: MessageType;
  metadata: Record<string, any>;
  is_edited: boolean;
  edited_at: string | null;
  created_at: string;
}

export interface ConversationWithDetails extends Conversation {
  participants: Array<{
    user_id: string;
    role: ParticipantRole;
    unread_count: number;
    last_read_at: string | null;
    profile?: {
      full_name: string;
      avatar_url: string | null;
    };
  }>;
  otherParticipant?: {
    user_id: string;
    role: ParticipantRole;
    full_name: string;
    avatar_url: string | null;
  };
}

export interface MessageWithSender extends Message {
  sender: {
    id: string;
    full_name: string;
    avatar_url: string | null;
    role: ParticipantRole;
  };
}

export interface CreateConversationParams {
  type: ConversationType;
  order_id?: string;
  participant_ids: string[];
  participant_roles: ParticipantRole[];
}

export interface SendMessageParams {
  conversation_id: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, any>;
}
