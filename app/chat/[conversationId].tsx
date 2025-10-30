import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Linking } from 'react-native';

import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { ArrowLeft, Send, Phone } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

interface Profile {
  full_name: string;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
  sender?: Profile | Profile[];
}

export default function ChatScreen() {
  const { conversationId, driverPhone } = useLocalSearchParams<{ conversationId?: string; driverPhone?: string }>();

  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (conversationId) {
      fetchMessages();
      subscribeToMessages();
    }
    
    return () => {
      // تنظيف الاشتراكات
      const channels = supabase.getChannels();
      channels.forEach(channel => {
        if (channel.topic.includes('realtime:public:chat_messages')) {
          supabase.removeChannel(channel);
        }
      });
    };
  }, [conversationId]);

  const subscribeToMessages = () => {
    if (!conversationId) return;
    
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          // تحديث قائمة الرسائل عند استلام رسالة جديدة
          if (payload.new) {
            const newMessage: Message = {
              id: payload.new.id,
              conversation_id: payload.new.conversation_id,
              sender_id: payload.new.sender_id,
              message_text: payload.new.message_text,
              is_read: payload.new.is_read,
              created_at: payload.new.created_at,
              sender: {
                full_name: payload.new.sender_id === user?.id ? 'أنت' : 'سائق'
              }
            };
            setMessages(prevMessages => [...prevMessages, newMessage]);
            
            // تحويل الرسالة إلى مقروءة إذا كانت من الطرف الآخر
            if (payload.new.sender_id !== user?.id) {
              markMessageAsRead(payload.new.id);
            }
          }
        }
      )
      .subscribe();
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('id', messageId);
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const fetchMessages = async () => {
    try {
      setLoading(true);
      
      // جلب الرسائل مع معلومات المرسل
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          conversation_id,
          sender_id,
          message_text,
          is_read,
          created_at,
          sender:profiles(full_name)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // تنسيق الرسائل
      const formattedMessages = data.map((msg: Message) => {
        // Handle the case where sender might be an array
        const senderProfile = Array.isArray(msg.sender) 
          ? msg.sender[0] 
          : msg.sender;
          
        return {
          ...msg,
          sender: {
            full_name: msg.sender_id === user?.id 
              ? 'أنت' 
              : (senderProfile?.full_name || 'سائق')
          }
        };
      });

      setMessages(formattedMessages);
      
      // تحويل جميع الرسائل إلى مقروءة
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', conversationId)
        .eq('is_read', false)
        .neq('sender_id', user?.id);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الرسائل');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchMessages();
  };

  const sendMessage = async () => {
    const convId = typeof conversationId === 'string' ? conversationId : undefined;
    if (!newMessage.trim() || !convId || !user) return;

    const text = newMessage.trim();
    setSending(true);

    try {
      // إرسال للسيرفر
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: convId,
          sender_id: user.id,
          message_text: text,
          is_read: false,
        })
        .select()
        .single();

      if (error) throw error;

      // تحديث متفائل محلي حتى لو تأخر الاشتراك اللحظي
      const optimistic: Message = {
        id: data?.id || Math.random().toString(36).slice(2),
        conversation_id: convId,
        sender_id: user.id,
        message_text: text,
        is_read: false,
        created_at: data?.created_at || new Date().toISOString(),
        sender: { full_name: 'أنت' },
      };
      setMessages(prev => [...prev, optimistic]);
      setNewMessage('');

      // التمرير إلى الأسفل بعد إرسال الرسالة
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isCurrentUser = (senderId: string) => {
    return senderId === user?.id;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>جاري تحميل الرسائل...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الدردشة</Text>
        <TouchableOpacity 
          style={styles.callButton}
          onPress={() => {
            if (typeof driverPhone === 'string' && driverPhone) {
              Linking.openURL(`tel:${driverPhone}`);
            } else {
              Alert.alert('خطأ', 'رقم السائق غير متوفر');
            }
          }}
        >
          <Phone size={20} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isMe = isCurrentUser(item.sender_id);
          
          return (
            <View style={[
              styles.messageContainer,
              isMe ? styles.myMessageContainer : styles.otherMessageContainer
            ]}>
              <View style={[
                styles.messageBubble,
                isMe ? styles.myMessageBubble : styles.otherMessageBubble
              ]}>
                <Text style={[
                  styles.messageText,
                  isMe ? styles.myMessageText : styles.otherMessageText
                ]}>
                  {item.message_text}
                </Text>
                <Text style={[
                  styles.messageTime,
                  isMe ? styles.myMessageTime : styles.otherMessageTime
                ]}>
                  {formatTime(item.created_at)}
                </Text>
              </View>
            </View>
          );
        }}
        contentContainerStyle={styles.messagesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Message Input */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.messageInput}
          placeholder="اكتب رسالتك..."
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
          onPress={sendMessage}
          disabled={!newMessage.trim() || sending}
        >
          {sending ? (
            <Text style={styles.sendButtonText}>جاري الإرسال...</Text>
          ) : (
            <Send size={20} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  callButton: {
    padding: spacing.sm,
  },
  messagesList: {
    padding: spacing.md,
  },
  messageContainer: {
    marginBottom: spacing.md,
    flexDirection: 'row',
  },
  myMessageContainer: {
    justifyContent: 'flex-end',
  },
  otherMessageContainer: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  myMessageBubble: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 0,
  },
  otherMessageBubble: {
    backgroundColor: colors.lightGray,
    borderBottomLeftRadius: 0,
  },
  messageText: {
    ...typography.body,
  },
  myMessageText: {
    color: colors.white,
  },
  otherMessageText: {
    color: colors.text,
  },
  messageTime: {
    ...typography.caption,
    marginTop: spacing.xs,
    textAlign: 'right',
  },
  myMessageTime: {
    color: colors.white + 'CC',
  },
  otherMessageTime: {
    color: colors.textLight,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  messageInput: {
    flex: 1,
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    textAlign: 'right',
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  sendButtonText: {
    ...typography.caption,
    color: colors.white,
  },
});