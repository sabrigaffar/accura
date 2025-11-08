import React, { useState, useEffect } from 'react';
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
  Power,
  Trash2,
  ChevronRight,
  DollarSign,
  Bell,
  MessageSquare,
  AlertCircle,
} from 'lucide-react-native';
import { spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { usePushNotifications } from '@/contexts/PushNotificationContext';
import { SUPPORTED_CURRENCIES, getCurrencyByCode } from '@/constants/currencies';

export default function DriverSettings() {
  const { user } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const { sendTestNotification } = usePushNotifications();
  const [settings, setSettings] = useState({
    darkMode: false,
    autoAcceptOrders: false,
    locationSharing: true,
    offlineMode: false,
  });
  const [loading, setLoading] = useState(true);
  const [selectedCurrency, setSelectedCurrency] = useState('SAR');

  // تحديث darkMode state من ThemeContext
  useEffect(() => {
    setSettings(prev => ({
      ...prev,
      darkMode: isDark,
    }));
  }, [isDark]);

  // جلب الإعدادات من قاعدة البيانات
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('driver_profiles')
          .select('auto_accept_orders, is_online, preferred_currency')
          .eq('id', user.id)
          .single();
        
        if (error) throw error;
        if (data) {
          setSettings(prev => ({
            ...prev,
            autoAcceptOrders: data.auto_accept_orders || false,
            offlineMode: !data.is_online,
          }));
          setSelectedCurrency(data.preferred_currency || 'SAR');
        }
      } catch (e) {
        console.error('fetch settings error:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [user?.id]);

  const toggleSetting = async (key: keyof typeof settings) => {
    // Dark Mode يتم التعامل معه بشكل منفصل
    if (key === 'darkMode') {
      toggleTheme();
      // لا حاجة لتحديث state - سيتم تلقائياً عبر useEffect
      return;
    }

    const newValue = !settings[key];
    setSettings((prev) => ({ ...prev, [key]: newValue }));

    // حفظ في قاعدة البيانات
    if (!user?.id) return;
    try {
      if (key === 'autoAcceptOrders') {
        const { error } = await supabase
          .from('driver_profiles')
          .update({ auto_accept_orders: newValue })
          .eq('id', user.id);
        if (error) throw error;
        Alert.alert('✅ تم الحفظ', `تم ${newValue ? 'تفعيل' : 'إيقاف'} قبول الطلبات تلقائياً`);
      } else if (key === 'offlineMode') {
        const { error } = await supabase
          .from('driver_profiles')
          .update({ is_online: !newValue })
          .eq('id', user.id);
        if (error) throw error;
        Alert.alert('✅ تم الحفظ', `تم ${newValue ? 'تفعيل' : 'إيقاف'} وضع غير متصل`);
      }
    } catch (e) {
      console.error('save setting error:', e);
      // عكس التغيير في حالة الخطأ
      setSettings((prev) => ({ ...prev, [key]: !newValue }));
      Alert.alert('❌ خطأ', 'فشل حفظ الإعداد. حاول مرة أخرى.');
    }
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
    },
    {
      icon: Power,
      title: 'قبول الطلبات تلقائياً',
      description: 'قبول أي طلب جديد تلقائياً',
      key: 'autoAcceptOrders' as const,
    },
    {
      icon: MapPin,
      title: 'مشاركة الموقع',
      description: 'مشاركة موقعك مع التطبيق',
      key: 'locationSharing' as const,
    },
    {
      icon: Power,
      title: 'وضع غير متصل',
      description: 'إخفاء حسابك من الطلبات المتاحة',
      key: 'offlineMode' as const,
    },
  ];

  const handleCurrencyChange = () => {
    const currencyOptions = SUPPORTED_CURRENCIES.map(c => ({
      text: `${c.symbol} ${c.nameAr}`,
      onPress: () => saveCurrency(c.code),
    }));
    
    Alert.alert(
      '💰 اختر العملة',
      'اختر العملة المفضلة لعرض الأسعار',
      [
        ...currencyOptions,
        { text: 'إلغاء', style: 'cancel' },
      ]
    );
  };

  const saveCurrency = async (currencyCode: string) => {
    if (!user?.id) return;
    try {
      const { error } = await supabase
        .from('driver_profiles')
        .update({ preferred_currency: currencyCode })
        .eq('id', user.id);
      
      if (error) throw error;
      
      setSelectedCurrency(currencyCode);
      const currency = getCurrencyByCode(currencyCode);
      Alert.alert('✅ تم الحفظ', `تم تغيير العملة إلى ${currency.nameAr}`);
    } catch (e) {
      console.error('save currency error:', e);
      Alert.alert('❌ خطأ', 'فشل حفظ العملة');
    }
  };

  const styles = createStyles(theme);

  const actionSettings = [
    {
      icon: Globe,
      title: 'اللغة',
      description: 'العربية (قيد التطوير)',
      onPress: () => Alert.alert('🚧 قيد التطوير', 'سيتم إضافة دعم اللغة الإنجليزية قريباً'),
    },
    {
      icon: DollarSign,
      title: 'العملة',
      description: getCurrencyByCode(selectedCurrency).nameAr,
      onPress: handleCurrencyChange,
    },
    {
      icon: Bell,
      title: 'إشعار تجريبي',
      description: 'اختبر نظام الإشعارات',
      onPress: sendTestNotification,
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
      icon: MessageSquare,
      title: 'الدعم الفني',
      description: 'تواصل مع فريق الدعم',
      onPress: () => router.push('/support/tickets' as any),
    },
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
                  </View>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <Switch
                  value={settings[item.key]}
                  onValueChange={() => toggleSetting(item.key)}
                  trackColor={{ false: theme.border, true: theme.primary }}
                  thumbColor={theme.white}
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
    backgroundColor: theme.card,
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
    backgroundColor: theme.card,
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
    backgroundColor: theme.card,
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
