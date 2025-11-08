import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { ShoppingBag, Truck, Wallet, Gift } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface QuickAction {
  id: string;
  title: string;
  icon: any;
  color: string;
  route: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'orders',
    title: 'طلباتي',
    icon: ShoppingBag,
    color: '#4ECDC4',
    route: '/orders',
  },
  {
    id: 'track',
    title: 'تتبع',
    icon: Truck,
    color: '#FF6B6B',
    route: '/orders',
  },
  {
    id: 'wallet',
    title: 'محفظتي',
    icon: Wallet,
    color: '#45B7D1',
    route: '/wallet',
  },
  {
    id: 'offers',
    title: 'عروض',
    icon: Gift,
    color: '#FFA07A',
    route: '/offers',
  },
];

export default function QuickActions() {
  const handleActionPress = (action: QuickAction) => {
    router.push(action.route as any);
  };

  return (
    <View style={styles.container}>
      {QUICK_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <TouchableOpacity
            key={action.id}
            style={styles.actionButton}
            onPress={() => handleActionPress(action)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconCircle, { backgroundColor: action.color + '20' }]}>
              <Icon size={24} color={action.color} strokeWidth={2.5} />
            </View>
            <Text style={styles.actionText}>{action.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButton: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
});
