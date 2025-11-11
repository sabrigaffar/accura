import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { ArrowLeft, Star } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function RateOrderScreen() {
  const { id } = useLocalSearchParams(); // order id
  const orderId = Array.isArray(id) ? id[0] : (id as string);

  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = (starRating: number) => {
    setRating(starRating);
  };

  // تحقق مسبقاً لتجنب محاولة إدراج مكررة (تؤدي لخطأ 23505)
  const hasReview = async (type: 'driver' | 'merchant') => {
    const { data } = await supabase
      .from('reviews')
      .select('id')
      .eq('order_id', orderId)
      .eq('reviewer_id', user?.id ?? '')
      .eq('reviewee_type', type)
      .maybeSingle();
    return !!data;
  };

  const submitRating = async () => {

    if (rating === 0) {
      Alert.alert('خطأ', 'الرجاء اختيار تقييم');
      return;
    }

    if (!user) {
      Alert.alert('خطأ', 'يجب تسجيل الدخول لتقييم الطلب');
      return;
    }

    setSubmitting(true);

    try {
      // استخدام RPC آمنة تمنع التكرار وتتحقق من "تم التسليم" وتعين المُقيَّم تلقائياً
      let anySubmitted = false;

      // تقييم السائق (إن لم يكن مُقيماً مسبقاً)
      try {
        const alreadyDriver = await hasReview('driver');
        if (!alreadyDriver) {
          const { error: drvErr } = await supabase.rpc('create_review', {
            p_order_id: orderId,
            p_reviewee_type: 'driver',
            p_rating: rating,
            p_comment: comment.trim() || null,
          });
          if (drvErr && !`${drvErr?.message || ''}`.includes('no driver assigned')) {
            throw drvErr;
          }
          if (!drvErr) anySubmitted = true;
        }
      } catch (e) {
        // إذا لم يوجد سائق للطلب نتجاهل هذا التقييم ونكمل بتقييم المتجر
        const msg = (e as any)?.message || '';
        if (!msg.includes('no driver assigned')) {
          throw e;
        }
      }

      // تقييم المتجر (إن لم يكن مُقيماً مسبقاً)
      const alreadyMerchant = await hasReview('merchant');
      if (!alreadyMerchant) {
        const { error: merErr } = await supabase.rpc('create_review', {
          p_order_id: orderId,
          p_reviewee_type: 'merchant',
          p_rating: rating,
          p_comment: comment.trim() || null,
        });
        if (merErr) throw merErr;
        anySubmitted = true;
      }

      if (!anySubmitted) {
        Alert.alert('تنبيه', 'لقد قمت بتقييم هذا الطلب مسبقاً');
      } else {
        Alert.alert(
          'نجاح',
          'تم إرسال تقييمك بنجاح',
          [
            {
              text: 'موافق',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error: any) {
      console.warn('Error submitting rating:', error);
      const code = error?.code;
      const msg: string = (error?.message || '').toString();
      if (code === '23505' || msg.includes('duplicate')) {
        Alert.alert('تنبيه', 'لقد قمت بتقييم هذا الطرف مسبقاً لهذا الطلب');
      } else if (msg.includes('order not delivered')) {
        Alert.alert('تنبيه', 'لا يمكن التقييم قبل تسليم الطلب');
      } else if (msg.includes('not your order')) {
        Alert.alert('تنبيه', 'لا يمكنك تقييم طلب لا يخص حسابك');
      } else {
        Alert.alert('خطأ', 'حدث خطأ أثناء إرسال التقييم');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تقييم الطلب</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>تقييمك للطلب</Text>
          <Text style={styles.sectionSubtitle}>شاركنا تجربتك مع الخدمة</Text>
        </View>

        {/* Rating Stars */}
        <View style={styles.section}>
          <Text style={styles.ratingLabel}>التقييم العام</Text>
          <View style={styles.starsContainer}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => handleStarPress(star)}
                style={styles.starButton}
              >
                <Star
                  size={40}
                  color={star <= rating ? colors.warning : colors.border}
                  fill={star <= rating ? colors.warning : 'transparent'}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingText}>
            {rating === 1 && 'سيء جداً'}
            {rating === 2 && 'سيء'}
            {rating === 3 && 'مقبول'}
            {rating === 4 && 'جيد'}
            {rating === 5 && 'ممتاز'}
            {rating === 0 && 'اختر تقييماً'}
          </Text>
        </View>

        {/* Comment Input */}
        <View style={styles.section}>
          <Text style={styles.commentLabel}>تعليقك (اختياري)</Text>
          <TextInput
            style={styles.commentInput}
            placeholder="شاركنا تفاصيل أكثر عن تجربتك..."
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={submitRating}
          disabled={submitting}
        >
          {submitting ? (
            <Text style={styles.submitButtonText}>جاري الإرسال...</Text>
          ) : (
            <Text style={styles.submitButtonText}>إرسال التقييم</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
  ratingLabel: {
    ...typography.h3,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  starButton: {
    marginHorizontal: spacing.sm,
  },
  ratingText: {
    ...typography.bodyMedium,
    color: colors.text,
    textAlign: 'center',
  },
  commentLabel: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  commentInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    textAlign: 'right',
  },
  footer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});