import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/contexts/ThemeContext';
import { useToast } from '@/contexts/ToastContext';
import * as Haptics from 'expo-haptics';

export default function SupportScreen() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { success: showToastSuccess, error: showToastError, info: showToastInfo } = useToast();

  const submitTicket = async () => {
    if (!user) {
      try { Haptics.selectionAsync(); } catch {}
      showToastInfo('الرجاء تسجيل الدخول أولاً');
      return;
    }
    if (!subject.trim() || !description.trim()) {
      try { Haptics.selectionAsync(); } catch {}
      showToastInfo('الرجاء إدخال الموضوع والوصف');
      return;
    }

    setLoading(true);
    try {
      const ticket = {
        ticket_number: `TCK-${Date.now()}`,
        user_id: user.id,
        subject: subject.trim(),
        description: description.trim(),
        status: 'open',
        priority: 'medium',
      };
      const { error } = await supabase.from('support_tickets').insert(ticket);
      if (error) throw error;
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
      showToastSuccess('تم إنشاء تذكرة الدعم بنجاح');
      setSubject('');
      setDescription('');
    } catch (e: any) {
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch {}
      showToastError(e.message || 'حدث خطأ أثناء إنشاء التذكرة');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>المساعدة والدعم</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>الموضوع</Text>
          <TextInput
            style={styles.input}
            placeholder="اكتب موضوع المشكلة"
            value={subject}
            onChangeText={setSubject}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>الوصف</Text>
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="اشرح مشكلتك بالتفصيل"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitDisabled]}
          onPress={submitTicket}
          disabled={loading}
        >
          <Text style={styles.submitText}>{loading ? 'جاري الإرسال...' : 'إرسال'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  header: {
    backgroundColor: theme.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: { ...typography.h2, color: theme.text, textAlign: 'center' },
  content: { flex: 1, padding: spacing.md },
  inputGroup: { marginBottom: spacing.lg },
  label: { ...typography.bodyMedium, color: theme.text, marginBottom: spacing.sm },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: theme.lightGray,
  },
  textarea: { minHeight: 120 },
  submitButton: {
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...typography.bodyMedium, color: theme.white },
});
