import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send, AlertCircle } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ChatMessage {
  id: string;
  sender_type: 'user' | 'support';
  message_text: string;
  created_at: string;
  is_read: boolean;
}

export default function SupportChatScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = theme;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const params = useLocalSearchParams<{
    ticketId: string;
    ticketNumber: string;
    subject: string;
  }>();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    fetchMessages();
    subscribeToMessages();
    
    return () => {
      // Cleanup subscription
    };
  }, [params.ticketId]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('support_chat_messages')
        .select('*')
        .eq('ticket_id', params.ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setMessages(data || []);
      
      // Mark support messages as read
      await markSupportMessagesAsRead();
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`support_chat:${params.ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'support_chat_messages',
          filter: `ticket_id=eq.${params.ticketId}`,
        },
        (payload) => {
          console.log('New message:', payload);
          setMessages((prev) => [...prev, payload.new as ChatMessage]);
          scrollToBottom();
          
          // Mark as read if from support
          if (payload.new.sender_type === 'support') {
            markMessageAsRead(payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markSupportMessagesAsRead = async () => {
    try {
      await supabase
        .from('support_chat_messages')
        .update({ is_read: true })
        .eq('ticket_id', params.ticketId)
        .eq('sender_type', 'support')
        .eq('is_read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('support_chat_messages')
        .update({ is_read: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);

      const { error } = await supabase.from('support_chat_messages').insert({
        ticket_id: params.ticketId,
        sender_id: user?.id,
        sender_type: 'user',
        message_text: newMessage.trim(),
        message_type: 'text',
      });

      if (error) throw error;

      setNewMessage('');
      scrollToBottom();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'اليوم';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'أمس';
    } else {
      return date.toLocaleDateString('ar-SA', {
        day: 'numeric',
        month: 'short',
      });
    }
  };

  const renderMessage = (message: ChatMessage, index: number) => {
    const isUser = message.sender_type === 'user';
    const showDate =
      index === 0 ||
      formatDate(message.created_at) !==
        formatDate(messages[index - 1]?.created_at);

    return (
      <View key={message.id}>
        {showDate && (
          <View style={styles.dateSeparator}>
            <Text style={styles.dateText}>{formatDate(message.created_at)}</Text>
          </View>
        )}
        
        <View
          style={[
            styles.messageContainer,
            isUser ? styles.userMessageContainer : styles.supportMessageContainer,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isUser ? styles.userMessageBubble : styles.supportMessageBubble,
            ]}
          >
            {!isUser && (
              <Text style={styles.senderName}>فريق الدعم الفني</Text>
            )}
            <Text
              style={[
                styles.messageText,
                isUser ? styles.userMessageText : styles.supportMessageText,
              ]}
            >
              {message.message_text}
            </Text>
            <Text
              style={[
                styles.timeText,
                isUser ? styles.userTimeText : styles.supportTimeText,
              ]}
            >
              {formatTime(message.created_at)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{params.subject || 'الدعم الفني'}</Text>
          <Text style={styles.headerSubtitle}>#{params.ticketNumber}</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري تحميل المحادثة...</Text>
        </View>
      ) : (
        <>
          {/* Messages */}
          <KeyboardAvoidingView
            style={styles.chatContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
          >
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesContainer}
              contentContainerStyle={styles.messagesContent}
              onContentSizeChange={() => scrollToBottom()}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <AlertCircle size={48} color={colors.textLight} />
                  <Text style={styles.emptyText}>
                    لا توجد رسائل بعد
                  </Text>
                  <Text style={styles.emptySubtext}>
                    ابدأ المحادثة مع فريق الدعم
                  </Text>
                </View>
              ) : (
                messages.map((message, index) => renderMessage(message, index))
              )}
            </ScrollView>

            {/* Input */}
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="اكتب رسالتك..."
                placeholderTextColor={colors.textLight}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
                maxLength={500}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || sending) && styles.sendButtonDisabled,
                ]}
                onPress={sendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Send size={20} color={colors.white} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </>
      )}
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerInfo: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      ...typography.h3,
      color: colors.text,
    },
    headerSubtitle: {
      ...typography.caption,
      color: colors.textSecondary,
      marginTop: 2,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      ...typography.body,
      color: colors.textSecondary,
      marginTop: spacing.md,
    },
    chatContainer: {
      flex: 1,
    },
    messagesContainer: {
      flex: 1,
    },
    messagesContent: {
      padding: spacing.lg,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: spacing.xl * 3,
    },
    emptyText: {
      ...typography.h3,
      color: colors.textSecondary,
      marginTop: spacing.lg,
    },
    emptySubtext: {
      ...typography.body,
      color: colors.textLight,
      marginTop: spacing.xs,
    },
    dateSeparator: {
      alignItems: 'center',
      marginVertical: spacing.lg,
    },
    dateText: {
      ...typography.caption,
      color: colors.textLight,
      backgroundColor: colors.lightGray,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.full,
    },
    messageContainer: {
      marginBottom: spacing.md,
    },
    userMessageContainer: {
      alignItems: 'flex-end',
    },
    supportMessageContainer: {
      alignItems: 'flex-start',
    },
    messageBubble: {
      maxWidth: '80%',
      padding: spacing.md,
      borderRadius: borderRadius.lg,
    },
    userMessageBubble: {
      backgroundColor: colors.primary,
      borderBottomRightRadius: 4,
    },
    supportMessageBubble: {
      backgroundColor: colors.card,
      borderBottomLeftRadius: 4,
    },
    senderName: {
      ...typography.caption,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: spacing.xs,
    },
    messageText: {
      ...typography.body,
      lineHeight: 20,
    },
    userMessageText: {
      color: colors.white,
    },
    supportMessageText: {
      color: colors.text,
    },
    timeText: {
      ...typography.caption,
      marginTop: spacing.xs,
    },
    userTimeText: {
      color: colors.white + 'CC',
    },
    supportTimeText: {
      color: colors.textLight,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    input: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: borderRadius.lg,
      padding: spacing.md,
      paddingTop: spacing.md,
      color: colors.text,
      ...typography.body,
      maxHeight: 100,
    },
    sendButton: {
      backgroundColor: colors.primary,
      width: 44,
      height: 44,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      backgroundColor: colors.textLight,
      opacity: 0.5,
    },
  });
