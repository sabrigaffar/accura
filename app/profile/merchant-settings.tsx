import React, { useEffect, useState } from 'react';
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
} from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MerchantSettings() {
  const [settings, setSettings] = useState({
    darkMode: false,
    autoAcceptOrders: false,
    storeOpen: true,
    offlineMode: false,
  });
  const [currency, setCurrency] = useState('ريال');

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
      description: 'تحديد أوقات فتح المتجر',
      onPress: () => Alert.alert('قريباً', 'خيارات ساعات العمل قيد التطوير'),
    },
    {
      icon: Trash2,
      title: 'مسح الكاش',
      description: 'حذف البيانات المؤقتة',
      onPress: handleClearCache,
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
