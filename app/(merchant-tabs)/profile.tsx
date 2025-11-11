import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { User, Store, LogOut, Settings, Bell, HelpCircle, Key } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function MerchantProfile() {
  const { profile, signOut } = useAuth();

  const handleSignOut = async () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: async () => {
            router.replace('/auth');
            // نفّذ تسجيل الخروج مباشرة بعد الانتقال لتجنب أي وميض واجهات
            setTimeout(() => { signOut(); }, 0);
          }
        }
      ]
    );
  };

  const menuItems = [
    {
      icon: Store,
      title: 'ملف المتجر',
      subtitle: 'إدارة معلومات متجرك',
      onPress: () => router.push('/profile/merchant-profile' as any),
    },
    {
      icon: User,
      title: 'معلومات الحساب',
      subtitle: 'البريد الإلكتروني ورقم الهاتف',
      onPress: () => router.push('/profile/merchant-account-info' as any),
    },
    {
      icon: Key,
      title: 'تغيير كلمة المرور',
      subtitle: 'تحديث كلمة مرور حسابك',
      onPress: () => router.push('/settings/change-password' as any),
    },
    {
      icon: Bell,
      title: 'الإشعارات',
      subtitle: 'إدارة إشعاراتك',
      onPress: () => router.push('/profile/merchant-notifications' as any),
    },
    {
      icon: Settings,
      title: 'الإعدادات',
      subtitle: 'تخصيص التطبيق',
      onPress: () => router.push('/profile/merchant-settings' as any),
    },
    {
      icon: HelpCircle,
      title: 'المساعدة والدعم',
      subtitle: 'تواصل معنا',
      onPress: () => router.push('/profile/merchant-help' as any),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>حسابي</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <User size={32} color={colors.white} />
          </View>
          <Text style={styles.name}>{profile?.full_name || 'تاجر'}</Text>
          <View style={styles.badge}>
            <Store size={14} color={colors.primary} />
            <Text style={styles.badgeText}>تاجر</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.menuItem}
              onPress={item.onPress}
            >
              <View style={styles.menuIcon}>
                <item.icon size={20} color={colors.primary} />
              </View>
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <LogOut size={20} color={colors.error} />
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  name: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.xs,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    gap: spacing.xs,
  },
  badgeText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  menuContainer: {
    marginTop: spacing.lg,
    backgroundColor: colors.white,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuContent: {
    flex: 1,
  },
  menuTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  menuSubtitle: {
    ...typography.caption,
    color: colors.textLight,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.error,
    gap: spacing.sm,
  },
  signOutText: {
    ...typography.bodyMedium,
    color: colors.error,
  },
});
