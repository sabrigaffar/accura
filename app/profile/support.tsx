import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function SupportScreen() {
  const { user } = useAuth();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const submitTicket = async () => {
    if (!user) {
      Alert.alert('خطأ', 'الرجاء تسجيل الدخول أولاً');
      return;
    }
    if (!subject.trim() || !description.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال الموضوع والوصف');
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
      Alert.alert('تم الإرسال', 'تم إنشاء تذكرة الدعم بنجاح');
      setSubject('');
      setDescription('');
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'حدث خطأ أثناء إنشاء التذكرة');
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  content: { flex: 1, padding: spacing.md },
  inputGroup: { marginBottom: spacing.lg },
  label: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.sm },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.lightGray,
  },
  textarea: { minHeight: 120 },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: { ...typography.bodyMedium, color: colors.white },
});
