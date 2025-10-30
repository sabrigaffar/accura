import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const PRIORITIES = [
  { value: 'low', label: 'منخفضة', color: '#94A3B8' },
  { value: 'medium', label: 'متوسطة', color: '#3B82F6' },
  { value: 'high', label: 'عالية', color: '#F59E0B' },
  { value: 'urgent', label: 'عاجلة', color: '#EF4444' },
];

export default function NewTicketScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = theme;
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [submitting, setSubmitting] = useState(false);

  const generateTicketNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TK-${timestamp}${random}`;
  };

  const handleSubmit = async () => {
    if (!subject.trim() || !description.trim()) {
      Alert.alert('تنبيه', 'يرجى ملء جميع الحقول');
      return;
    }

    try {
      setSubmitting(true);

      const ticketNumber = generateTicketNumber();

      // إنشاء التذكرة
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          ticket_number: ticketNumber,
          user_id: user?.id,
          subject: subject.trim(),
          description: description.trim(),
          priority: priority,
          status: 'open',
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // إرسال رسالة ترحيبية تلقائية
      await supabase.from('support_chat_messages').insert({
        ticket_id: ticket.id,
        sender_id: user?.id,
        sender_type: 'user',
        message_text: description.trim(),
        message_type: 'text',
      });

      Alert.alert('✅ تم بنجاح', 'تم إنشاء تذكرة الدعم. سيتم الرد عليك قريباً', [
        {
          text: 'موافق',
          onPress: () => {
            router.replace({
              pathname: '/support/chat' as any,
              params: {
                ticketId: ticket.id,
                ticketNumber: ticketNumber,
                subject: subject,
              },
            });
          },
        },
      ]);
    } catch (error) {
      console.error('Error creating ticket:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إنشاء التذكرة');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تذكرة دعم جديدة</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* الموضوع */}
        <View style={styles.section}>
          <Text style={styles.label}>الموضوع *</Text>
          <TextInput
            style={styles.input}
            placeholder="مثال: مشكلة في التوصيل"
            placeholderTextColor={colors.textLight}
            value={subject}
            onChangeText={setSubject}
            maxLength={100}
          />
        </View>

        {/* الوصف */}
        <View style={styles.section}>
          <Text style={styles.label}>الوصف التفصيلي *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="اشرح المشكلة أو الاستفسار بالتفصيل..."
            placeholderTextColor={colors.textLight}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
            maxLength={1000}
          />
          <Text style={styles.characterCount}>
            {description.length} / 1000
          </Text>
        </View>

        {/* الأولوية */}
        <View style={styles.section}>
          <Text style={styles.label}>الأولوية</Text>
          <View style={styles.priorityContainer}>
            {PRIORITIES.map((item) => (
              <TouchableOpacity
                key={item.value}
                style={[
                  styles.priorityButton,
                  priority === item.value && styles.priorityButtonActive,
                  { borderColor: item.color },
                  priority === item.value && { backgroundColor: item.color + '20' },
                ]}
                onPress={() => setPriority(item.value as any)}
              >
                <View
                  style={[
                    styles.priorityDot,
                    { backgroundColor: item.color },
                  ]}
                />
                <Text
                  style={[
                    styles.priorityText,
                    priority === item.value && { color: item.color, fontWeight: '600' },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* نصائح */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 نصائح للحصول على أفضل دعم:</Text>
          <Text style={styles.tipText}>• اشرح المشكلة بوضوح وتفصيل</Text>
          <Text style={styles.tipText}>• أضف معلومات إضافية إن أمكن (رقم الطلب، الوقت، إلخ)</Text>
          <Text style={styles.tipText}>• حدد الأولوية المناسبة</Text>
          <Text style={styles.tipText}>• سيتم الرد عليك في أقرب وقت ممكن</Text>
        </View>
      </ScrollView>

      {/* زر الإرسال */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (!subject.trim() || !description.trim() || submitting) &&
              styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!subject.trim() || !description.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Send size={20} color={colors.white} />
              <Text style={styles.submitButtonText}>إرسال التذكرة</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    backButton: {
      padding: spacing.xs,
    },
    headerTitle: {
      ...typography.h2,
      color: colors.text,
    },
    content: {
      flex: 1,
      padding: spacing.lg,
    },
    section: {
      marginBottom: spacing.xl,
    },
    label: {
      ...typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      color: colors.text,
      ...typography.body,
      borderWidth: 1,
      borderColor: colors.border,
    },
    textArea: {
      minHeight: 120,
      paddingTop: spacing.md,
    },
    characterCount: {
      ...typography.caption,
      color: colors.textLight,
      textAlign: 'left',
      marginTop: spacing.xs,
    },
    priorityContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    priorityButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      borderWidth: 1.5,
      backgroundColor: colors.card,
    },
    priorityButtonActive: {
      borderWidth: 2,
    },
    priorityDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    priorityText: {
      ...typography.body,
      color: colors.textSecondary,
    },
    tipsContainer: {
      backgroundColor: colors.primary + '10',
      borderRadius: borderRadius.md,
      padding: spacing.md,
      marginBottom: spacing.xl,
    },
    tipsTitle: {
      ...typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    tipText: {
      ...typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.xs,
      paddingLeft: spacing.sm,
    },
    footer: {
      padding: spacing.lg,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    submitButton: {
      backgroundColor: colors.primary,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    submitButtonDisabled: {
      backgroundColor: colors.textLight,
      opacity: 0.5,
    },
    submitButtonText: {
      ...typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
  });
