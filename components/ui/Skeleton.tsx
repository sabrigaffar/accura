import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, borderRadius, spacing } from '@/constants/theme';

interface SkeletonBlockProps {
  width?: number | `${number}%` | 'auto';
  height: number;
  borderRadius?: number;
  style?: ViewStyle | ViewStyle[];
}

export const SkeletonBlock: React.FC<SkeletonBlockProps> = ({ width = '100%' as `${number}%`, height, borderRadius: br = borderRadius.md, style }) => {
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(opacity, { toValue: 0.6, duration: 900, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View style={[styles.skeleton, { width, height, borderRadius: br, opacity }, style]} />
  );
};

export const MerchantGridCardSkeleton: React.FC = () => {
  return (
    <View style={{ width: '48%', marginHorizontal: '1%', marginBottom: spacing.md }}>
      <SkeletonBlock width={'100%'} height={120} borderRadius={borderRadius.lg} />
      <View style={{ marginTop: 8 }}>
        <SkeletonBlock width={'70%'} height={12} style={{ marginBottom: 6 }} />
        <SkeletonBlock width={'50%'} height={10} />
      </View>
    </View>
  );
};

export const MerchantCardSkeleton: React.FC = () => {
  return (
    <View style={styles.card}>
      <SkeletonBlock width={80} height={80} />
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <SkeletonBlock width={160} height={16} style={{ marginBottom: 8 }} />
        <SkeletonBlock width={'80%'} height={12} style={{ marginBottom: 6 }} />
        <SkeletonBlock width={'60%'} height={12} />
      </View>
    </View>
  );
};

export const OrderCardSkeleton: React.FC = () => {
  return (
    <View style={styles.card}>
      <View style={{ flex: 1 }}>
        <SkeletonBlock width={'40%'} height={14} style={{ marginBottom: 10 }} />
        <SkeletonBlock width={'60%'} height={12} style={{ marginBottom: 6 }} />
        <SkeletonBlock width={'30%'} height={12} />
      </View>
    </View>
  );
};

export const NotificationItemSkeleton: React.FC = () => {
  return (
    <View style={[styles.card, { marginHorizontal: 16 }] }>
      <SkeletonBlock width={48} height={48} borderRadius={24} />
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <SkeletonBlock width={'70%'} height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock width={'95%'} height={12} style={{ marginBottom: 6 }} />
        <SkeletonBlock width={'50%'} height={10} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.lightGray,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
  },
});

export default SkeletonBlock;
