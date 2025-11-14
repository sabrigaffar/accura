import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { MessageCircle } from 'lucide-react-native';
import { router } from 'expo-router';
import { colors, shadows } from '@/constants/theme';
import { useChat } from '@/contexts/ChatContext';

interface Props {
  targetPath?: string; // optional when using onPress handler
  onPress?: () => void; // custom handler (e.g., open bottom sheet)
}

export default function FloatingChatButton({ targetPath, onPress }: Props) {
  const { unreadCount } = useChat?.() || { unreadCount: 0 };

  const badgeText = useMemo(() => {
    if (!unreadCount || unreadCount <= 0) return '';
    if (unreadCount > 99) return '99+';
    return String(unreadCount);
  }, [unreadCount]);

  const handlePress = () => {
    if (onPress) return onPress();
    if (targetPath) router.push(targetPath as any);
  };

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <TouchableOpacity activeOpacity={0.9} style={styles.fab} onPress={handlePress}>
        <MessageCircle size={26} color={colors.white} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badgeText}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    right: 16,
    bottom: Platform.select({ ios: 100, android: 88, default: 88 }),
    zIndex: 999,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.large,
  },
  badge: {
    position: 'absolute',
    top: -4,
    left: -4,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 11,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
});
