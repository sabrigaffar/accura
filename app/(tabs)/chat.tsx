import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MessageCircle, ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { useChat } from '@/contexts/ChatContext';
import type { ConversationWithDetails } from '@/types/chat';

export default function ChatScreen() {
  const { conversations, unreadCount, loading, refreshConversations } = useChat();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  };

  const handleConversationPress = (conversationId: string) => {
    router.push(`/chat/${conversationId}`);
  };

  const renderConversationItem = ({ item }: { item: ConversationWithDetails }) => {
    const otherParticipant = item.otherParticipant;
    const myParticipant = item.participants.find(p => p.user_id !== otherParticipant?.user_id);
    const hasUnread = myParticipant ? myParticipant.unread_count > 0 : false;

    return (
      <TouchableOpacity
        style={[styles.conversationItem, hasUnread && styles.unreadItem]}
        onPress={() => handleConversationPress(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarContainer}>
          {otherParticipant?.avatar_url ? (
            <Image
              source={{ uri: otherParticipant.avatar_url }}
              style={styles.avatar}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {otherParticipant?.full_name?.[0] || '؟'}
              </Text>
            </View>
          )}
          {hasUnread && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={[styles.conversationName, hasUnread && styles.unreadText]}>
              {otherParticipant?.full_name || 'مستخدم'}
            </Text>
            <Text style={styles.conversationTime}>
              {item.last_message_at ? formatTime(item.last_message_at) : ''}
            </Text>
          </View>

          <View style={styles.conversationFooter}>
            <Text
              style={[styles.lastMessage, hasUnread && styles.unreadText]}
              numberOfLines={1}
            >
              {item.last_message || 'لا توجد رسائل'}
            </Text>
            {hasUnread && myParticipant && myParticipant.unread_count > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {myParticipant.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ChevronLeft size={20} color={colors.textLight} />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MessageCircle size={64} color={colors.textLight} />
      <Text style={styles.emptyTitle}>لا توجد محادثات</Text>
      <Text style={styles.emptyText}>
        ستظهر محادثاتك مع التجار والسائقين هنا
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <MessageCircle size={24} color={colors.text} />
          <Text style={styles.headerTitle}>المحادثات</Text>
          {unreadCount > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>
      </View>

      <FlatList
        data={conversations}
        renderItem={renderConversationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          conversations.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `${diffMins}د`;
  if (diffHours < 24) return `${diffHours}س`;
  if (diffDays < 7) return `${diffDays}ي`;
  
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
  },
  headerBadge: {
    backgroundColor: colors.error,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  headerBadgeText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.sm,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    ...shadows.small,
  },
  unreadItem: {
    backgroundColor: '#EEF2FF',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.white,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.white,
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  conversationName: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
  },
  conversationTime: {
    ...typography.caption,
    color: colors.textLight,
  },
  conversationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  lastMessage: {
    ...typography.body,
    color: colors.textLight,
    flex: 1,
  },
  unreadText: {
    color: colors.primary,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
});
