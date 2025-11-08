import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Bell, Package, DollarSign, MessageSquare, Volume2, Star } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MerchantNotifications() {
  const [notifications, setNotifications] = useState({
    newOrders: true,
    orderUpdates: true,
    reviews: true,
    messages: false,
    sound: true,
    vibration: true,
  });

  // Load saved preferences
  useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('merchant_notification_settings');
      if (saved) {
        setNotifications(JSON.parse(saved));
      }
    } catch (error) {
      console.log('Error loading notification settings:', error);
    }
  };

  const toggleNotification = async (key: keyof typeof notifications) => {
    const newSettings = { ...notifications, [key]: !notifications[key] };
    setNotifications(newSettings);
    
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('merchant_notification_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.log('Error saving notification settings:', error);
    }
  };

  const notificationSettings = [
    {
      icon: Package,
      title: 'طلبات جديدة',
      description: 'إشعار عند وصول طلب جديد',
      key: 'newOrders' as const,
    },
    {
      icon: Package,
      title: 'تحديثات الطلبات',
      description: 'إشعار عند تحديث حالة الطلب',
      key: 'orderUpdates' as const,
    },
    {
      icon: Star,
      title: 'التقييمات',
      description: 'إشعار عند استلام تقييم جديد',
      key: 'reviews' as const,
    },
    {
      icon: MessageSquare,
      title: 'الرسائل',
      description: 'إشعار عند وصول رسائل جديدة',
      key: 'messages' as const,
    },
  ];

  const soundSettings = [
    {
      icon: Volume2,
      title: 'الصوت',
      description: 'تشغيل صوت عند وصول إشعار',
      key: 'sound' as const,
    },
    {
      icon: Bell,
      title: 'الاهتزاز',
      description: 'اهتزاز الجهاز عند وصول إشعار',
      key: 'vibration' as const,
    },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإشعارات</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Notification Types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أنواع الإشعارات</Text>
          <View style={styles.card}>
            {notificationSettings.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.settingItem,
                  index === notificationSettings.length - 1 && styles.lastItem,
                ]}
              >
                <View style={styles.settingIcon}>
                  <item.icon size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <Switch
                  value={notifications[item.key]}
                  onValueChange={() => toggleNotification(item.key)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Sound & Vibration */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>الصوت والاهتزاز</Text>
          <View style={styles.card}>
            {soundSettings.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.settingItem,
                  index === soundSettings.length - 1 && styles.lastItem,
                ]}
              >
                <View style={styles.settingIcon}>
                  <item.icon size={20} color={colors.primary} />
                </View>
                <View style={styles.settingContent}>
                  <Text style={styles.settingTitle}>{item.title}</Text>
                  <Text style={styles.settingDescription}>{item.description}</Text>
                </View>
                <Switch
                  value={notifications[item.key]}
                  onValueChange={() => toggleNotification(item.key)}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.white}
                />
              </View>
            ))}
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <Bell size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            تأكد من تفعيل الإشعارات في إعدادات الجهاز للحصول على التنبيهات في الوقت المناسب
          </Text>
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
  settingTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    ...typography.caption,
    color: colors.textLight,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primary + '10',
    padding: spacing.lg,
    margin: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  infoText: {
    flex: 1,
    ...typography.caption,
    color: colors.primary,
    lineHeight: 18,
  },
});
