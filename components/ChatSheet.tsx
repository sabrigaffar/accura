import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Platform, Dimensions } from 'react-native';
import { X } from 'lucide-react-native';
import { router } from 'expo-router';
import { useChat } from '@/contexts/ChatContext';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';

interface ChatSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  navigateTo?: string; // path to open when selecting a conversation
  fabBottom?: number; // distance of FAB from bottom (absolute)
  fabSize?: number;   // FAB height
  gapAboveFab?: number; // extra gap between sheet and FAB
}

export default function ChatSheet({ visible, onClose, title = 'المحادثات', navigateTo, fabBottom, fabSize, gapAboveFab }: ChatSheetProps) {
  const { conversations, refreshConversations } = useChat();

  useEffect(() => {
    if (visible) refreshConversations();
  }, [visible]);

  const renderItem = ({ item }: any) => (
    <TouchableOpacity style={styles.item} onPress={() => {
      router.push(`/chat/${item.id}` as any);
      onClose();
    }}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemTitle}>{item.otherParticipant?.full_name || 'محادثة'}</Text>
        <Text style={styles.itemDate}>{item.last_message_at ? new Date(item.last_message_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
      </View>
      <Text style={styles.itemSubtitle} numberOfLines={1}>{item.last_message || 'ابدأ المحادثة'}</Text>
    </TouchableOpacity>
  );

  if (!visible) return null;
  const bottomOffset = fabBottom ?? (Platform.select({ ios: 100, android: 88, default: 88 }) as number);
  const btnSize = fabSize ?? 56;
  const gap = gapAboveFab ?? 20;
  const sheetHeight = Math.max(380, Math.min(SCREEN_HEIGHT * 0.78, SCREEN_HEIGHT - (bottomOffset + btnSize + gap)));
  return (
    <View pointerEvents="box-none" style={styles.overlayContainer}>
      {/* Backdrop to close on outside tap */}
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={[styles.backdrop, { bottom: bottomOffset + btnSize }]} />
      <View style={[styles.sheet, { height: sheetHeight, marginBottom: bottomOffset + btnSize + gap }]}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {!conversations || conversations.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>لا توجد محادثات بعد</Text>
            </View>
          ) : (
            <FlatList
              style={{ flex: 1 }}
              data={conversations}
              keyExtractor={(it) => it.id}
              renderItem={renderItem}
              contentContainerStyle={{ padding: spacing.md }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const SHEET_SIDE_MARGIN = 12;
const SCREEN_HEIGHT = Dimensions.get('window').height;
// ارتفاع مناسب: لا يتجاوز 78% من الشاشة، ولا يقل عن 380px، ويترك هامشاً فوق الزر العائم
// height computed per-render using props

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 998,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  sheet: {
    marginHorizontal: SHEET_SIDE_MARGIN,
    marginTop: 28, // لا تلمس الحافة العليا
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl || 16,
    maxHeight: '90%',
    overflow: 'hidden',
    ...shadows.medium,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  title: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: { flex: 1 },
  item: { backgroundColor: '#fff', borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.border },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  itemTitle: { ...typography.bodyMedium, color: colors.text },
  itemSubtitle: { ...typography.caption, color: colors.textLight },
  itemDate: { ...typography.caption, color: colors.textLight },
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  emptyText: { ...typography.body, color: colors.textLight },
});
