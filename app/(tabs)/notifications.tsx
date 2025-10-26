/**
 * شاشة الإشعارات - Notifications Screen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Check, CheckCheck, Trash2, X } from 'lucide-react-native';
import { useNotifications } from '@/contexts/NotificationContext';
import type { Notification } from '@/types/notification';

export default function NotificationsScreen() {
  const {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshNotifications();
    setRefreshing(false);
  };

  const handleMarkAllAsRead = () => {
    Alert.alert(
      'وضع علامة مقروء على الكل',
      'هل تريد وضع علامة مقروء على جميع الإشعارات؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم',
          onPress: markAllAsRead,
        },
      ]
    );
  };

  const handleDeleteNotification = (notificationId: string) => {
    Alert.alert(
      'حذف الإشعار',
      'هل تريد حذف هذا الإشعار؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => deleteNotification(notificationId),
        },
      ]
    );
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'order':
        return '📦';
      case 'message':
        return '💬';
      case 'review':
        return '⭐';
      case 'status_update':
        return '🔔';
      case 'promotion':
        return '🎁';
      default:
        return '📢';
    }
  };

  const renderNotificationItem = ({ item }: { item: Notification }) => {
    const isUnread = !item.is_read;

    return (
      <TouchableOpacity
        style={[styles.notificationItem, isUnread && styles.unreadItem]}
        onPress={() => !isUnread && markAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.notificationIcon}>
          <Text style={styles.iconEmoji}>{getNotificationIcon(item.type)}</Text>
        </View>

        <View style={styles.notificationContent}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, isUnread && styles.unreadText]}>
              {item.title}
            </Text>
            {isUnread && <View style={styles.unreadBadge} />}
          </View>

          <Text style={styles.notificationBody} numberOfLines={2}>
            {item.body}
          </Text>

          <Text style={styles.notificationTime}>
            {formatTime(item.created_at)}
          </Text>
        </View>

        <View style={styles.notificationActions}>
          {isUnread ? (
            <TouchableOpacity
              onPress={() => markAsRead(item.id)}
              style={styles.actionButton}
            >
              <Check size={20} color="#10B981" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => handleDeleteNotification(item.id)}
              style={styles.actionButton}
            >
              <Trash2 size={20} color="#EF4444" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Bell size={64} color="#9CA3AF" strokeWidth={1.5} />
      <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
      <Text style={styles.emptyText}>سنخبرك عندما يحدث شيء جديد</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Bell size={24} color="#111827" />
          <Text style={styles.headerTitle}>الإشعارات</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
        </View>

        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={handleMarkAllAsRead}
            style={styles.markAllButton}
          >
            <CheckCheck size={20} color="#6366F1" />
            <Text style={styles.markAllText}>قراءة الكل</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotificationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          notifications.length === 0 && styles.emptyListContent,
        ]}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
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
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  if (diffDays < 7) return `منذ ${diffDays} يوم`;
  
  return date.toLocaleDateString('ar-EG', {
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  markAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  markAllText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  emptyListContent: {
    flex: 1,
    justifyContent: 'center',
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadItem: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 4,
    borderLeftColor: '#6366F1',
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 24,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  unreadText: {
    color: '#4F46E5',
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366F1',
  },
  notificationBody: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 20,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  notificationActions: {
    justifyContent: 'center',
    marginLeft: 8,
  },
  actionButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
