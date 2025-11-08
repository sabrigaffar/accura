import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Globe,
  Moon,
  MapPin,
  Trash2,
  ChevronRight,
  AlertCircle,
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

export default function CustomerSettings() {
  const [settings, setSettings] = useState({
    darkMode: false,
    saveLocation: true,
    shareData: false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClearCache = () => {
    Alert.alert(
      'مسح الكاش',
      'هل تريد مسح جميع البيانات المؤقتة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح',
          style: 'destructive',
          onPress: () => Alert.alert('تم', 'تم مسح الكاش بنجاح'),
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'حذف الحساب',
      'هل أنت متأكد من حذف حسابك؟ لا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => Alert.alert('تنبيه', 'يرجى التواصل مع الدعم لحذف الحساب'),
        },
      ]
    );
  };

  const switchSettings = [
    {
      icon: Moon,
      title: 'الوضع الليلي',
      description: 'تفعيل المظهر الداكن',
      key: 'darkMode' as const,
      badge: 'قريباً',
    },
    {
      icon: MapPin,
      title: 'حفظ الموقع',
      description: 'حفظ موقعك للطلبات السريعة',
      key: 'saveLocation' as const,
    },
    {
      icon: Globe,
      title: 'مشاركة البيانات',
      description: 'مشاركة بيانات الاستخدام لتحسين الخدمة',
      key: 'shareData' as const,
    },
  ];

  const actionSettings = [
    {
      icon: Globe,
      title: 'اللغة',
      description: 'العربية',
      onPress: () => Alert.alert('قريباً', 'خيارات اللغة قيد التطوير'),
    },
    {
      icon: MapPin,
      title: 'عناويني',
      description: 'إدارة عناوين التوصيل',
      onPress: () => router.push('/profile/addresses'),
    },
    {
      icon: Trash2,
      title: 'مسح الكاش',
      description: 'حذف البيانات المؤقتة',
      onPress: handleClearCache,
    },
  ];

  const supportSettings = [
    {
      icon: AlertCircle,
      title: 'الشكاوى',
      description: 'عرض وإدارة شكاويك',
      onPress: () => router.push('/profile/complaints' as any),
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإعدادات</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إعدادات التطبيق</Text>
          <View style={styles.card}>
            {switchSettings.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.settingItem,
                  index === switchSettings.length - 1 && styles.lastItem,
                ]}
              >
                <View style={styles.settingIcon}>
                  <item.icon size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <View style={styles.settingTitleRow}>
                    <Text style={styles.settingTitle}>{item.title}</Text>
                    {item.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <Switch
                  value={settings[item.key]}
                  onValueChange={() => toggleSetting(item.key)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                  disabled={!!item.badge}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Other Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>إعدادات أخرى</Text>
          <View style={styles.card}>
            {actionSettings.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.settingItem,
                  index === actionSettings.length - 1 && styles.lastItem,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.settingIcon}>
                  <item.icon size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <ChevronRight size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Support Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الدعم</Text>
          <View style={styles.card}>
            {supportSettings.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.settingItem,
                  index === supportSettings.length - 1 && styles.lastItem,
                ]}
                onPress={item.onPress}
              >
                <View style={styles.settingIcon}>
                  <item.icon size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <ChevronRight size={20} color={colors.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>منطقة الخطر</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Trash2 size={20} color={colors.error} />
            <View style={styles.dangerContent}>
              <Text style={styles.dangerTitle}>حذف الحساب</Text>
              <Text style={styles.dangerDescription}>
                حذف حسابك بشكل نهائي من التطبيق
              </Text>
            </View>
            <ChevronRight size={20} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* App Version */}
        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>إصدار التطبيق: 1.0.0</Text>
        </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: colors.text,
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  settingTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.secondary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    color: colors.secondary,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textLight,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.error + '30',
  },
  dangerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  dangerTitle: {
    ...typography.bodyMedium,
    color: colors.error,
    marginBottom: spacing.xs,
  },
  dangerDescription: {
    ...typography.caption,
    color: colors.textLight,
  },
  versionContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  versionText: {
    ...typography.caption,
    color: colors.textLight,
  },
});
