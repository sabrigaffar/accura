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
import { ArrowLeft, Clock, Calendar } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveStore } from '@/contexts/ActiveStoreContext';

type DaySchedule = {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
};

type WeekSchedule = {
  [key: string]: DaySchedule;
};

const DAYS = [
  { key: 'sunday', label: 'الأحد' },
  { key: 'monday', label: 'الإثنين' },
  { key: 'tuesday', label: 'الثلاثاء' },
  { key: 'wednesday', label: 'الأربعاء' },
  { key: 'thursday', label: 'الخميس' },
  { key: 'friday', label: 'الجمعة' },
  { key: 'saturday', label: 'السبت' },
];

export default function MerchantWorkingHours() {
  const { user } = useAuth();
  const { activeStore, isAllStoresSelected } = useActiveStore();
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<WeekSchedule>({
    sunday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    monday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    tuesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    wednesday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    thursday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
    friday: { isOpen: false, openTime: '09:00', closeTime: '22:00' },
    saturday: { isOpen: true, openTime: '09:00', closeTime: '22:00' },
  });

  useEffect(() => {
    loadMerchantData();
  }, []);

  const loadMerchantData = async () => {
    try {
      setLoading(true);
      
      if (!user) {
        Alert.alert('خطأ', 'يجب تسجيل الدخول أولاً');
        router.back();
        return;
      }

      // Check if a specific store is selected
      if (isAllStoresSelected || !activeStore) {
        Alert.alert(
          'اختر متجراً',
          'الرجاء اختيار متجر محدد لتحديد ساعات العمل',
          [{ text: 'حسناً', onPress: () => router.back() }]
        );
        return;
      }

      // Use active store
      const { data: merchantData, error: merchantError } = await supabase
        .from('merchants')
        .select('id, working_hours')
        .eq('id', activeStore.id)
        .single();

      if (merchantError) {
        console.error('Error loading merchant:', merchantError);
        Alert.alert('خطأ', 'فشل تحميل بيانات المتجر');
        return;
      }

      setMerchantId(merchantData.id);

      // Load working hours from database
      if (merchantData.working_hours) {
        setSchedule(merchantData.working_hours as WeekSchedule);
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async (newSchedule: WeekSchedule) => {
    if (!merchantId) {
      Alert.alert('خطأ', 'لم يتم العثور على بيانات المتجر');
      return;
    }

    try {
      // Save to Supabase
      const { error } = await supabase
        .from('merchants')
        .update({ working_hours: newSchedule })
        .eq('id', merchantId);

      if (error) {
        console.error('Error saving schedule:', error);
        Alert.alert('خاطء', 'فشل حفظ ساعات العمل');
        return;
      }

      // Also save locally as backup
      await AsyncStorage.setItem('merchant_working_hours', JSON.stringify(newSchedule));
      
      Alert.alert('✅ تم', 'تم حفظ ساعات العمل بنجاح. سيتمكن العملاء من رؤيتها.');
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('خطأ', 'فشل حفظ ساعات العمل');
    }
  };

  const toggleDay = (day: string) => {
    const newSchedule = {
      ...schedule,
      [day]: { ...schedule[day], isOpen: !schedule[day].isOpen },
    };
    setSchedule(newSchedule);
  };

  const handleTimeChange = (day: string, type: 'openTime' | 'closeTime') => {
    const currentTime = schedule[day][type];
    
    Alert.prompt(
      type === 'openTime' ? 'وقت الفتح' : 'وقت الإغلاق',
      `أدخل الوقت بصيغة HH:MM (مثال: ${currentTime})`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حفظ',
          onPress: (value?: string) => {
            if (value && /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(value)) {
              const newSchedule = {
                ...schedule,
                [day]: { ...schedule[day], [type]: value },
              };
              setSchedule(newSchedule);
            } else {
              Alert.alert('خطأ', 'صيغة الوقت غير صحيحة. استخدم HH:MM');
            }
          },
        },
      ],
      'plain-text',
      currentTime
    );
  };

  const applyToAll = () => {
    Alert.alert(
      'تطبيق على الكل',
      'هل تريد تطبيق ساعات الأحد على جميع الأيام؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تطبيق',
          onPress: () => {
            const sundaySchedule = schedule.sunday;
            const newSchedule: WeekSchedule = {};
            DAYS.forEach(day => {
              newSchedule[day.key] = { ...sundaySchedule };
            });
            setSchedule(newSchedule);
            Alert.alert('✅ تم', 'تم تطبيق ساعات العمل على جميع الأيام');
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>ساعات العمل</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ساعات العمل</Text>
        <TouchableOpacity onPress={() => saveSchedule(schedule)}>
          <Text style={styles.saveButton}>حفظ</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickButton} onPress={applyToAll}>
            <Calendar size={20} color={colors.primary} />
            <Text style={styles.quickButtonText}>تطبيق على الكل</Text>
          </TouchableOpacity>
        </View>

        {/* Days Schedule */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>جدول الأسبوع</Text>
          <View style={styles.card}>
            {DAYS.map((day, index) => (
              <View
                key={day.key}
                style={[
                  styles.dayItem,
                  index === DAYS.length - 1 && styles.lastItem,
                ]}
              >
                <View style={styles.dayHeader}>
                  <View style={styles.dayInfo}>
                    <Clock size={18} color={colors.textLight} />
                    <Text style={styles.dayLabel}>{day.label}</Text>
                  </View>
                  <Switch
                    value={schedule[day.key].isOpen}
                    onValueChange={() => toggleDay(day.key)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor={colors.white}
                  />
                </View>

                {schedule[day.key].isOpen && (
                  <View style={styles.timeRow}>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => handleTimeChange(day.key, 'openTime')}
                    >
                      <Text style={styles.timeLabel}>من</Text>
                      <Text style={styles.timeValue}>{schedule[day.key].openTime}</Text>
                    </TouchableOpacity>

                    <Text style={styles.timeSeparator}>—</Text>

                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => handleTimeChange(day.key, 'closeTime')}
                    >
                      <Text style={styles.timeLabel}>إلى</Text>
                      <Text style={styles.timeValue}>{schedule[day.key].closeTime}</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {!schedule[day.key].isOpen && (
                  <Text style={styles.closedText}>مغلق</Text>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <Clock size={20} color={colors.primary} />
          <Text style={styles.infoText}>
            سيتم عرض متجرك للعملاء فقط خلال ساعات العمل المحددة
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
  saveButton: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  quickActions: {
    padding: spacing.lg,
  },
  quickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary + '10',
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  quickButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    marginTop: spacing.md,
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
  dayItem: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  dayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dayLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
  },
  timeButton: {
    alignItems: 'center',
    padding: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: borderRadius.md,
    minWidth: 100,
  },
  timeLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  timeValue: {
    ...typography.h3,
    color: colors.primary,
  },
  timeSeparator: {
    ...typography.h3,
    color: colors.textLight,
  },
  closedText: {
    ...typography.body,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border + '50',
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
  },
});
