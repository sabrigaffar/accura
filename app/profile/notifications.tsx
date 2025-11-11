import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, Mail, Smartphone, Package, Tag } from 'lucide-react-native';
import { spacing, borderRadius, typography } from '@/constants/theme';
import { useTheme } from '@/contexts/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [notifications, setNotifications] = useState({
    push: true,
    email: false,
    sms: true,
  });

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem('notification_channels');
        if (saved) {
          const parsed = JSON.parse(saved);
          setNotifications({
            push: typeof parsed.push === 'boolean' ? parsed.push : true,
            email: typeof parsed.email === 'boolean' ? parsed.email : false,
            sms: typeof parsed.sms === 'boolean' ? parsed.sms : true,
          });
        }
      } catch {}
    })();
  }, []);

  const notificationSettings = [
    {
      id: 'orders',
      title: 'تحديثات الطلبات',
      description: 'إشعارات حول حالة طلباتك',
      icon: Package,
    },
    {
      id: 'offers',
      title: 'العروض والخصومات',
      description: 'العروض الخاصة والخصومات',
      icon: Tag,
    },
    {
      id: 'delivery',
      title: 'تتبع التوصيل',
      description: 'تحديثات حول موقع طلبك',
      icon: Bell,
    },
  ];

  const toggleNotification = async (type: 'push' | 'email' | 'sms') => {
    const next = { ...notifications, [type]: !notifications[type] };
    setNotifications(next);
    try {
      await AsyncStorage.setItem('notification_channels', JSON.stringify(next));
    } catch {}
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الإشعارات</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>قنوات الإشعارات</Text>
          <View style={styles.channelContainer}>
            <View style={styles.channelItem}>
              <View style={styles.channelInfo}>
                <Smartphone size={20} color={theme.primary} />
                <View style={styles.channelText}>
                  <Text style={styles.channelTitle}>الإشعارات الفورية</Text>
                  <Text style={styles.channelDescription}>إرسال إشعارات إلى جوالك</Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: theme.border, true: theme.primary + '40' }}
                thumbColor={notifications.push ? theme.primary : theme.white}
                ios_backgroundColor={theme.border}
                onValueChange={() => toggleNotification('push')}
                value={notifications.push}
              />
            </View>

            <View style={styles.channelItem}>
              <View style={styles.channelInfo}>
                <Mail size={20} color={theme.primary} />
                <View style={styles.channelText}>
                  <Text style={styles.channelTitle}>البريد الإلكتروني</Text>
                  <Text style={styles.channelDescription}>إرسال تحديثات عبر البريد</Text>
                </View>
              </View>
              <Switch
                trackColor={{ false: theme.border, true: theme.primary + '40' }}
                thumbColor={notifications.email ? theme.primary : theme.white}
                ios_backgroundColor={theme.border}
                onValueChange={() => toggleNotification('email')}
                value={notifications.email}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أنواع الإشعارات</Text>
          {notificationSettings.map((setting) => {
            const Icon = setting.icon;
            return (
              <TouchableOpacity key={setting.id} style={styles.settingItem}>
                <View style={styles.settingInfo}>
                  <Icon size={20} color={theme.primary} />
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>{setting.title}</Text>
                    <Text style={styles.settingDescription}>{setting.description}</Text>
                  </View>
                </View>
                <Switch
                  trackColor={{ false: theme.border, true: theme.primary + '40' }}
                  thumbColor={theme.primary}
                  ios_backgroundColor={theme.border}
                  value={true}
                />
              </TouchableOpacity>
            );
          })}
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
    backgroundColor: theme.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    ...typography.h2,
    color: theme.text,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: theme.white,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.text,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  channelContainer: {
    padding: spacing.md,
    paddingTop: 0,
  },
  channelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  channelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  channelText: {
    marginRight: spacing.md,
  },
  channelTitle: {
    ...typography.body,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  channelDescription: {
    ...typography.caption,
    color: theme.textLight,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingText: {
    marginRight: spacing.md,
  },
  settingTitle: {
    ...typography.body,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    ...typography.caption,
    color: theme.textLight,
  },
});