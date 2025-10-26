/**
 * ChatContext - إدارة حالة الدردشة عبر التطبيق
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { chatService } from '@/lib/chatService';
import { supabase } from '@/lib/supabase';
import type {
  ConversationWithDetails,
  MessageWithSender,
  SendMessageParams,
} from '@/types/chat';

interface ChatContextType {
  conversations: ConversationWithDetails[];
  currentConversation: ConversationWithDetails | null;
  messages: MessageWithSender[];
  unreadCount: number;
  loading: boolean;
  loadingMessages: boolean;
  refreshConversations: () => Promise<void>;
  selectConversation: (conversationId: string) => Promise<void>;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  markAsRead: (conversationId: string) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [currentConversation, setCurrentConversation] = useState<ConversationWithDetails | null>(null);
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);

  // تهيئة والحصول على المستخدم
  useEffect(() => {
    const initialize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        setUserId(user.id);
        await loadConversations(user.id);
      } catch (error) {
        console.error('خطأ في تهيئة الدردشة:', error);
      } finally {
        setLoading(false);
      }
    };

    initialize();
  }, []);

  // تحميل المحادثات
  const loadConversations = async (uid: string) => {
    try {
      const [convs, count] = await Promise.all([
        chatService.getConversations(uid),
        chatService.getUnreadConversationsCount(uid),
      ]);

      setConversations(convs);
      setUnreadCount(count);
    } catch (error) {
      console.error('خطأ في تحميل المحادثات:', error);
    }
  };

  // تحديث المحادثات
  const refreshConversations = useCallback(async () => {
    if (!userId) return;
    await loadConversations(userId);
  }, [userId]);

  // اختيار محادثة
  const selectConversation = useCallback(async (conversationId: string) => {
    if (!userId) return;

    try {
      setLoadingMessages(true);
      
      // جلب تفاصيل المحادثة
      const conversation = await chatService.getConversation(conversationId);
      setCurrentConversation(conversation);

      // جلب الرسائل
      const msgs = await chatService.getMessages(conversationId);
      setMessages(msgs);
      setHasMoreMessages(msgs.length >= 50);

      // وضع علامة مقروء
      await chatService.markConversationAsRead(conversationId, userId);
      
      // تحديث عدد غير المقروءة
      const count = await chatService.getUnreadConversationsCount(userId);
      setUnreadCount(count);
    } catch (error) {
      console.error('خطأ في اختيار المحادثة:', error);
    } finally {
      setLoadingMessages(false);
    }
  }, [userId]);

  // إرسال رسالة
  const sendMessage = useCallback(async (params: SendMessageParams) => {
    const message = await chatService.sendMessage(params);
    if (message) {
      // الرسالة ستُضاف تلقائياً عبر Realtime subscription
    }
  }, []);

  // وضع علامة مقروء
  const markAsRead = useCallback(async (conversationId: string) => {
    if (!userId) return;
    await chatService.markConversationAsRead(conversationId, userId);
    const count = await chatService.getUnreadConversationsCount(userId);
    setUnreadCount(count);
  }, [userId]);

  // تحميل المزيد من الرسائل
  const loadMoreMessages = useCallback(async () => {
    if (!currentConversation || !hasMoreMessages || messages.length === 0) return;

    try {
      const oldestMessage = messages[0];
      const olderMessages = await chatService.getMessages(
        currentConversation.id,
        50,
        oldestMessage.created_at
      );

      if (olderMessages.length > 0) {
        setMessages((prev) => [...olderMessages, ...prev]);
        setHasMoreMessages(olderMessages.length >= 50);
      } else {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('خطأ في تحميل المزيد من الرسائل:', error);
    }
  }, [currentConversation, messages, hasMoreMessages]);

  // الاشتراك في تحديثات المحادثات
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = chatService.subscribeToConversations(
      userId,
      async (conversation) => {
        console.log('تحديث محادثة:', conversation);
        await loadConversations(userId);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  // الاشتراك في الرسائل الجديدة للمحادثة الحالية
  useEffect(() => {
    if (!currentConversation) return;

    const unsubscribe = chatService.subscribeToMessages(
      currentConversation.id,
      async (message) => {
        console.log('رسالة جديدة:', message);
        
        // جلب معلومات المرسل
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .eq('id', message.sender_id)
          .single();

        const messageWithSender: MessageWithSender = {
          ...message,
          sender: {
            id: message.sender_id,
            full_name: profile?.full_name || 'مستخدم',
            avatar_url: profile?.avatar_url || null,
            role: profile?.role || 'customer',
          },
        };

        setMessages((prev) => [...prev, messageWithSender]);

        // إذا كانت الرسالة ليست من المستخدم الحالي
        if (message.sender_id !== userId) {
          // وضع علامة مقروء تلقائياً إذا كانت المحادثة مفتوحة
          await chatService.markConversationAsRead(currentConversation.id, userId!);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [currentConversation, userId]);

  // الاشتراك في تحديثات المشاركين (عدد غير المقروءة)
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = chatService.subscribeToParticipantUpdates(
      userId,
      async (participant) => {
        console.log('تحديث مشارك:', participant);
        const count = await chatService.getUnreadConversationsCount(userId);
        setUnreadCount(count);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const value: ChatContextType = {
    conversations,
    currentConversation,
    messages,
    unreadCount,
    loading,
    loadingMessages,
    refreshConversations,
    selectConversation,
    sendMessage,
    markAsRead,
    loadMoreMessages,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
