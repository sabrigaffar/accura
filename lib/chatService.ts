/**
 * خدمة الدردشة - Chat Service
 * تدير المحادثات والرسائل في الوقت الفعلي
 */

import { supabase } from './supabase';
import type {
  Conversation,
  ConversationWithDetails,
  Message,
  MessageWithSender,
  ConversationParticipant,
  CreateConversationParams,
  SendMessageParams,
  ConversationType,
  ParticipantRole,
} from '@/types/chat';

class ChatService {
  /**
   * الحصول على جميع المحادثات للمستخدم الحالي
   */
  async getConversations(userId: string): Promise<ConversationWithDetails[]> {
    try {
      // الحصول على المحادثات التي يشارك فيها المستخدم
      const { data: participations, error: participationError } = await supabase
        .from('conversation_participants')
        .select('conversation_id, role, unread_count, last_read_at')
        .eq('user_id', userId);

      if (participationError) throw participationError;
      if (!participations || participations.length === 0) return [];

      const conversationIds = participations.map((p) => p.conversation_id);

      // الحصول على تفاصيل المحادثات
      const { data: conversations, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .in('id', conversationIds)
        .order('updated_at', { ascending: false });

      if (conversationError) throw conversationError;
      if (!conversations) return [];

      // الحصول على جميع المشاركين في هذه المحادثات
      const { data: allParticipants, error: allParticipantsError } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          user_id,
          role,
          unread_count,
          last_read_at
        `)
        .in('conversation_id', conversationIds);

      if (allParticipantsError) throw allParticipantsError;

      // الحصول على معلومات المستخدمين (من profiles)
      const participantUserIds = allParticipants?.map((p) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', participantUserIds);

      const profilesMap = new Map(
        profiles?.map((p) => [p.id, p]) || []
      );

      // دمج البيانات
      const conversationsWithDetails: ConversationWithDetails[] = conversations.map((conv) => {
        const convParticipants = allParticipants?.filter(
          (p) => p.conversation_id === conv.id
        ) || [];

        const participants = convParticipants.map((p) => ({
          user_id: p.user_id,
          role: p.role as ParticipantRole,
          unread_count: p.unread_count,
          last_read_at: p.last_read_at,
          profile: profilesMap.get(p.user_id),
        }));

        // إيجاد المشارك الآخر (غير المستخدم الحالي)
        const otherParticipant = participants.find((p) => p.user_id !== userId);

        return {
          ...conv,
          participants,
          otherParticipant: otherParticipant ? {
            user_id: otherParticipant.user_id,
            role: otherParticipant.role,
            full_name: otherParticipant.profile?.full_name || 'مستخدم',
            avatar_url: otherParticipant.profile?.avatar_url || null,
          } : undefined,
        };
      });

      return conversationsWithDetails;
    } catch (error) {
      console.error('خطأ في جلب المحادثات:', error);
      return [];
    }
  }

  /**
   * الحصول على تفاصيل محادثة معينة
   */
  async getConversation(conversationId: string): Promise<ConversationWithDetails | null> {
    try {
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (conversationError) throw conversationError;
      if (!conversation) return null;

      // الحصول على المشاركين
      const { data: participants, error: participantsError } = await supabase
        .from('conversation_participants')
        .select('user_id, role, unread_count, last_read_at')
        .eq('conversation_id', conversationId);

      if (participantsError) throw participantsError;

      // الحصول على معلومات المستخدمين
      const participantUserIds = participants?.map((p) => p.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', participantUserIds);

      const profilesMap = new Map(
        profiles?.map((p) => [p.id, p]) || []
      );

      const participantsWithProfiles = (participants || []).map((p) => ({
        user_id: p.user_id,
        role: p.role as ParticipantRole,
        unread_count: p.unread_count,
        last_read_at: p.last_read_at,
        profile: profilesMap.get(p.user_id),
      }));

      return {
        ...conversation,
        participants: participantsWithProfiles,
      };
    } catch (error) {
      console.error('خطأ في جلب المحادثة:', error);
      return null;
    }
  }

  /**
   * إنشاء محادثة جديدة
   */
  async createConversation(params: CreateConversationParams): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('create_conversation_with_participants', {
        p_type: params.type,
        p_order_id: params.order_id || null,
        p_participant_ids: params.participant_ids,
        p_participant_roles: params.participant_roles,
      });

      if (error) throw error;
      return data as string;
    } catch (error) {
      console.error('خطأ في إنشاء المحادثة:', error);
      return null;
    }
  }

  /**
   * البحث عن أو إنشاء محادثة بين مستخدمين
   */
  async getOrCreateConversation(
    type: ConversationType,
    user1Id: string,
    user1Role: ParticipantRole,
    user2Id: string,
    user2Role: ParticipantRole,
    orderId?: string
  ): Promise<string | null> {
    try {
      const { data, error } = await supabase.rpc('get_or_create_conversation', {
        p_type: type,
        p_order_id: orderId || null,
        p_user1_id: user1Id,
        p_user1_role: user1Role,
        p_user2_id: user2Id,
        p_user2_role: user2Role,
      });

      if (error) throw error;
      return data as string;
    } catch (error) {
      console.error('خطأ في البحث عن أو إنشاء المحادثة:', error);
      return null;
    }
  }

  /**
   * الحصول على رسائل محادثة معينة
   */
  async getMessages(
    conversationId: string,
    limit = 50,
    before?: string
  ): Promise<MessageWithSender[]> {
    try {
      let query = supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data: messages, error: messagesError } = await query;

      if (messagesError) throw messagesError;
      if (!messages || messages.length === 0) return [];

      // الحصول على معلومات المرسلين
      const senderIds = [...new Set(messages.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', senderIds);

      const profilesMap = new Map(
        profiles?.map((p) => [p.id, p]) || []
      );

      const messagesWithSenders: MessageWithSender[] = messages.map((msg) => {
        const profile = profilesMap.get(msg.sender_id);
        return {
          ...msg,
          sender: {
            id: msg.sender_id,
            full_name: profile?.full_name || 'مستخدم',
            avatar_url: profile?.avatar_url || null,
            role: profile?.role as ParticipantRole || 'customer',
          },
        };
      });

      return messagesWithSenders.reverse(); // ترتيب تصاعدي
    } catch (error) {
      console.error('خطأ في جلب الرسائل:', error);
      return [];
    }
  }

  /**
   * إرسال رسالة
   */
  async sendMessage(params: SendMessageParams): Promise<Message | null> {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('المستخدم غير مسجل الدخول');

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: params.conversation_id,
          sender_id: user.user.id,
          content: params.content,
          type: params.type || 'text',
          metadata: params.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data as Message;
    } catch (error) {
      console.error('خطأ في إرسال الرسالة:', error);
      return null;
    }
  }

  /**
   * تعديل رسالة
   */
  async editMessage(messageId: string, newContent: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('messages')
        .update({
          content: newContent,
          is_edited: true,
          edited_at: new Date().toISOString(),
        })
        .eq('id', messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في تعديل الرسالة:', error);
      return false;
    }
  }

  /**
   * حذف رسالة
   */
  async deleteMessage(messageId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في حذف الرسالة:', error);
      return false;
    }
  }

  /**
   * وضع علامة مقروء على المحادثة
   */
  async markConversationAsRead(conversationId: string, userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({
          last_read_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq('conversation_id', conversationId)
        .eq('user_id', userId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في وضع علامة مقروء:', error);
      return false;
    }
  }

  /**
   * الحصول على عدد المحادثات غير المقروءة
   */
  async getUnreadConversationsCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('unread_count')
        .eq('user_id', userId)
        .gt('unread_count', 0);

      if (error) throw error;
      return data?.length || 0;
    } catch (error) {
      console.error('خطأ في عد المحادثات غير المقروءة:', error);
      return 0;
    }
  }

  /**
   * الحصول على مجموع الرسائل غير المقروءة
   */
  async getTotalUnreadCount(userId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('conversation_participants')
        .select('unread_count')
        .eq('user_id', userId);

      if (error) throw error;
      return data?.reduce((sum, p) => sum + p.unread_count, 0) || 0;
    } catch (error) {
      console.error('خطأ في عد الرسائل غير المقروءة:', error);
      return 0;
    }
  }

  /**
   * الاشتراك في الرسائل الجديدة في محادثة معينة
   */
  subscribeToMessages(
    conversationId: string,
    callback: (message: Message) => void
  ) {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          callback(payload.new as Message);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * الاشتراك في تحديثات المحادثات
   */
  subscribeToConversations(userId: string, callback: (conversation: Conversation) => void) {
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations',
        },
        async (payload) => {
          // التحقق من أن المستخدم مشارك في هذه المحادثة
          const conversation = payload.new as unknown as Conversation;
          const { data } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id)
            .eq('user_id', userId)
            .single();

          if (data) {
            callback(conversation);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        async (payload) => {
          const conversation = payload.new as unknown as Conversation;
          const { data } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conversation.id)
            .eq('user_id', userId)
            .single();
          if (data) {
            callback(conversation);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * الاشتراك في تحديثات المشاركين (لتحديث عدد الرسائل غير المقروءة)
   */
  subscribeToParticipantUpdates(
    userId: string,
    callback: (participant: ConversationParticipant) => void
  ) {
    const channel = supabase
      .channel('participant-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participants',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as unknown as ConversationParticipant);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'conversation_participants',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          callback(payload.new as unknown as ConversationParticipant);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * البحث في الرسائل
   */
  async searchMessages(conversationId: string, query: string): Promise<MessageWithSender[]> {
    try {
      const { data: messages, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .ilike('content', `%${query}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      if (!messages || messages.length === 0) return [];

      // الحصول على معلومات المرسلين
      const senderIds = [...new Set(messages.map((m) => m.sender_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', senderIds);

      const profilesMap = new Map(
        profiles?.map((p) => [p.id, p]) || []
      );

      return messages.map((msg) => {
        const profile = profilesMap.get(msg.sender_id);
        return {
          ...msg,
          sender: {
            id: msg.sender_id,
            full_name: profile?.full_name || 'مستخدم',
            avatar_url: profile?.avatar_url || null,
            role: profile?.role as ParticipantRole || 'customer',
          },
        };
      });
    } catch (error) {
      console.error('خطأ في البحث في الرسائل:', error);
      return [];
    }
  }
}

// تصدير instance واحدة من الخدمة
export const chatService = new ChatService();
