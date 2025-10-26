/**
 * شاشة المحادثة الفردية - Individual Chat Screen
 */

import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Send, Image as ImageIcon } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { useChat } from '@/contexts/ChatContext';
import type { MessageWithSender } from '@/types/chat';

export default function ChatConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const {
    currentConversation,
    messages,
    loadingMessages,
    selectConversation,
    sendMessage,
    markAsRead,
    loadMoreMessages,
  } = useChat();

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (id) {
      selectConversation(id);
      markAsRead(id);
    }
  }, [id]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !id || sending) return;

    setSending(true);
    setMessageText('');

    try {
      await sendMessage({
        conversation_id: id,
        content: messageText.trim(),
        type: 'text',
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setMessageText(messageText); // Restore message on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item, index }: { item: MessageWithSender; index: number }) => {
    const isMyMessage = item.sender_id === currentConversation?.participants[0]?.user_id;
    const showAvatar = index === 0 || messages[index - 1]?.sender_id !== item.sender_id;
    const showName = !isMyMessage && showAvatar;

    return (
      <View style={[styles.messageContainer, isMyMessage && styles.myMessageContainer]}>
        {!isMyMessage && (
          <View style={styles.avatarContainer}>
            {showAvatar ? (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.sender.full_name[0]}</Text>
              </View>
            ) : (
              <View style={styles.avatarSpacer} />
            )}
          </View>
        )}

        <View style={[styles.messageBubble, isMyMessage ? styles.myMessage : styles.otherMessage]}>
          {showName && (
            <Text style={styles.senderName}>{item.sender.full_name}</Text>
          )}
          <Text style={[styles.messageText, isMyMessage && styles.myMessageText]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMyMessage && styles.myMessageTime]}>
              {formatMessageTime(item.created_at)}
            </Text>
            {item.is_edited && (
              <Text style={[styles.editedLabel, isMyMessage && styles.myMessageTime]}>
                • معدلة
              </Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
        <ArrowLeft size={24} color={colors.text} />
      </TouchableOpacity>

      <View style={styles.headerInfo}>
        <View style={styles.headerAvatar}>
          <Text style={styles.headerAvatarText}>
            {currentConversation?.otherParticipant?.full_name?.[0] || '؟'}
          </Text>
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>
            {currentConversation?.otherParticipant?.full_name || 'مستخدم'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {currentConversation?.otherParticipant?.role === 'merchant' ? 'تاجر' :
             currentConversation?.otherParticipant?.role === 'driver' ? 'سائق' : 'عميل'}
          </Text>
        </View>
      </View>

      <View style={styles.headerActions}>
        {/* يمكن إضافة أزرار إضافية هنا */}
      </View>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <TouchableOpacity style={styles.attachButton}>
        <ImageIcon size={24} color={colors.textLight} />
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        placeholder="اكتب رسالة..."
        placeholderTextColor={colors.textLight}
        value={messageText}
        onChangeText={setMessageText}
        multiline
        maxLength={1000}
        editable={!sending}
      />

      <TouchableOpacity
        style={[styles.sendButton, (!messageText.trim() || sending) && styles.sendButtonDisabled]}
        onPress={handleSend}
        disabled={!messageText.trim() || sending}
      >
        {sending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Send size={20} color={colors.white} />
        )}
      </TouchableOpacity>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>لا توجد رسائل بعد</Text>
      <Text style={styles.emptySubtext}>ابدأ المحادثة بإرسال رسالة</Text>
    </View>
  );

  if (loadingMessages) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messagesList,
            messages.length === 0 && styles.emptyList,
          ]}
          ListEmptyComponent={renderEmpty}
          onEndReached={loadMoreMessages}
          onEndReachedThreshold={0.5}
          showsVerticalScrollIndicator={false}
          inverted={false}
        />

        {renderFooter()}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerAvatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.white,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerSubtitle: {
    ...typography.caption,
    color: colors.textLight,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  messagesList: {
    padding: spacing.md,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textLight,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    maxWidth: '80%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  avatarContainer: {
    width: 32,
    marginHorizontal: spacing.xs,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  avatarSpacer: {
    width: 32,
    height: 32,
  },
  messageBubble: {
    borderRadius: borderRadius.lg,
    padding: spacing.sm,
    maxWidth: '100%',
  },
  myMessage: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    ...shadows.small,
  },
  senderName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  messageText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 20,
  },
  myMessageText: {
    color: colors.white,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: 4,
  },
  messageTime: {
    ...typography.caption,
    color: colors.textLight,
    fontSize: 11,
  },
  myMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  editedLabel: {
    ...typography.caption,
    color: colors.textLight,
    fontSize: 11,
    fontStyle: 'italic',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  attachButton: {
    padding: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    ...typography.body,
    color: colors.text,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: colors.textLight,
    opacity: 0.5,
  },
});
