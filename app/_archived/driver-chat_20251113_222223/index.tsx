import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { router } from 'expo-router';
import { useChat } from '@/contexts/ChatContext';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export const options = { href: null };

export default function DriverChatListScreen() {
  const { conversations, refreshConversations } = useChat();

  useEffect(() => {
    refreshConversations();
  }, []);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={styles.item} onPress={() => router.push(`/chat/${item.id}`)}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.otherParticipant?.full_name || 'محادثة'}</Text>
        <Text style={styles.itemDate}>{item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
      </View>
      <Text style={styles.itemSubtitle} numberOfLines={1}>{item.last_message || 'ابدأ المحادثة'}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {(!conversations || conversations.length === 0) ? (
        <View style={styles.empty}> 
          <Text style={styles.emptyText}>لا توجد محادثات بعد</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={{ padding: spacing.md }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  item: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemTitle: { ...typography.bodyMedium, color: colors.text },
  itemSubtitle: { ...typography.caption, color: colors.textLight },
  itemDate: { ...typography.caption, color: colors.textLight },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { ...typography.body, color: colors.textLight },
});
