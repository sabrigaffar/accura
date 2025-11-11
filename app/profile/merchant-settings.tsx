import React, { useEffect, useMemo, useState } from 'react';
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
  Clock,
  Power,
  Trash2,
  ChevronRight,
  TrendingUp,
  AlertCircle,
} from 'lucide-react-native';
import { spacing, typography, borderRadius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import * as Haptics from 'expo-haptics';

export default function MerchantSettings() {
  const [settings, setSettings] = useState({
    darkMode: false,
    autoAcceptOrders: false,
    storeOpen: true,
    offlineMode: false,
  });
  const [currency, setCurrency] = useState('ريال');
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { success: showToastSuccess, error: showToastError, info: showToastInfo } = useToast();

  useEffect(() => {
    (async () => {
      try {
        const symbol = await AsyncStorage.getItem('app_currency_symbol');
        if (symbol) setCurrency(symbol);
      } catch {}
    })();
  }, []);

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleClearCache = () => {
    Alert.alert(
      'مسح الكاش',
      'هل تريد مسح جميع البيانات المؤقتة؟ هذا لن يؤثر على البيانات الأساسية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear specific cache items (keep important data like auth)
              const keysToRemove = [
                'merchant_notification_settings',
                'app_currency_symbol',
                // Add other cache keys as needed
              ];
              
              await Promise.all(keysToRemove.map(key => AsyncStorage.removeItem(key)));
              
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
              showToastSuccess('تم مسح الكاش بنجاح');
              
              // Reset settings to defaults
              setSettings({
                darkMode: false,
                autoAcceptOrders: false,
                storeOpen: true,
                offlineMode: false,
              });
              setCurrency('ريال');
            } catch (error) {
              try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
              showToastError('فشل مسح الكاش. حاول مرة أخرى.');
            }
          },
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
      icon: Power,
      title: 'قبول الطلبات تلقائياً',
      description: 'قبول أي طلب جديد تلقائياً',
      key: 'autoAcceptOrders' as const,
    },
    {
      icon: Clock,
      title: 'المتجر مفتوح',
      description: 'إظهار متجرك متاح للطلبات',
      key: 'storeOpen' as const,
    },
    {
      icon: Power,
      title: 'وضع غير متصل',
      description: 'إخفاء متجرك من قائمة المتاجر',
      key: 'offlineMode' as const,
    },
  ];

  const actionSettings = [
    {
      icon: TrendingUp,
      title: 'الإعلانات المموّلة',
      description: 'إنشاء وإدارة إعلاناتك المدفوعة',
      onPress: () => router.push('/merchant/sponsored-ads' as any),
    },
    {
      icon: Globe,
      title: 'العملة',
      description: currency,
      onPress: async () => {
        try {
          const options = [
            'ريال',
            'جنيه',
            'دولار $',
            'درهم د.إ',
            'يورو €',
            'إلغاء',
          ];

          Alert.alert(
            'اختر العملة',
            'سيتم استخدام العملة المختارة في لوحة التحكم',
            [
              { text: options[0], onPress: async () => { setCurrency('ريال'); await AsyncStorage.setItem('app_currency_symbol', 'ريال'); } },
              { text: options[1], onPress: async () => { setCurrency('جنيه'); await AsyncStorage.setItem('app_currency_symbol', 'جنيه'); } },
              { text: options[2], onPress: async () => { setCurrency('دولار $'); await AsyncStorage.setItem('app_currency_symbol', 'دولار $'); } },
              { text: options[3], onPress: async () => { setCurrency('درهم د.إ'); await AsyncStorage.setItem('app_currency_symbol', 'درهم د.إ'); } },
              { text: options[4], onPress: async () => { setCurrency('يورو €'); await AsyncStorage.setItem('app_currency_symbol', 'يورو €'); } },
              { text: options[5], style: 'cancel' },
            ]
          );
        } catch {}
      },
    },
    {
      icon: Clock,
      title: 'ساعات العمل',
      description: 'تحديد أوقات فتح وإغلاق المتجر',
      onPress: () => router.push('/profile/merchant-working-hours' as any),
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
          <ArrowLeft size={24} color={theme.text} />
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
                  <item.icon size={20} color={theme.primary} />
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
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={theme.white}
                  disabled={!!item.badge}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Action Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خيارات أخرى</Text>
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
                  <item.icon size={20} color={theme.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <ChevronRight size={20} color={theme.textLight} />
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
                  <item.icon size={20} color={theme.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <ChevronRight size={20} color={theme.textLight} />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>منطقة الخطر</Text>
          <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
            <Trash2 size={20} color={theme.error} />
            <View style={styles.dangerContent}>
              <Text style={styles.dangerTitle}>حذف الحساب</Text>
              <Text style={styles.dangerDescription}>
                حذف حسابك بشكل نهائي من التطبيق
              </Text>
            </View>
            <ChevronRight size={20} color={theme.error} />
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

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    backgroundColor: theme.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    color: theme.text,
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
    color: theme.text,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: theme.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.border,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary + '10',
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
    color: theme.text,
  },
  badge: {
    backgroundColor: theme.secondary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  badgeText: {
    ...typography.caption,
    fontSize: 10,
    color: theme.secondary,
  },
  settingDescription: {
    ...typography.caption,
    color: theme.textLight,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: theme.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: theme.error + '30',
  },
  dangerContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  dangerTitle: {
    ...typography.bodyMedium,
    color: theme.error,
    marginBottom: spacing.xs,
  },
  dangerDescription: {
    ...typography.caption,
    color: theme.textLight,
  },
  versionContainer: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  versionText: {
    ...typography.caption,
    color: theme.textLight,
  },
});
