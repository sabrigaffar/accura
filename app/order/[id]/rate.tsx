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
import { updateMerchantRating, updateDriverRating } from '@/lib/ratingUtils';

export default function RateOrderScreen() {
  const { id } = useLocalSearchParams(); // order id
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleStarPress = (starRating: number) => {
    setRating(starRating);
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
      // الحصول على معلومات الطلب مع معلومات المتجر
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          merchant_id,
          driver_id,
          merchant:merchants(owner_id)
        `)
        .eq('id', id)
        .single();

      if (orderError) throw orderError;
      if (!order) throw new Error('Order not found');

      // إدراج التقييم للسائق
      if (order.driver_id) {
        const { error: driverReviewError } = await supabase
          .from('reviews')
          .insert({
            order_id: id,
            reviewer_id: user.id,
            reviewee_id: order.driver_id,
            reviewee_type: 'driver',
            rating: rating,
            comment: comment.trim(),
          });

        if (driverReviewError) {
          console.warn('Could not create driver review:', driverReviewError);
        } else {
          // تحديث تقييم السائق
          await updateDriverRating(order.driver_id);
        }
      }

      // إدراج التقييم للمتجر (باستخدام owner_id)
      // Handle merchant data which could be an array or object
      const merchantData = Array.isArray(order.merchant) ? order.merchant[0] : order.merchant;
      if (merchantData && merchantData.owner_id) {
        const { error: merchantReviewError } = await supabase
          .from('reviews')
          .insert({
            order_id: id,
            reviewer_id: user.id,
            reviewee_id: merchantData.owner_id,
            reviewee_type: 'merchant',
            rating: rating,
            comment: comment.trim(),
          });

        if (merchantReviewError) {
          console.warn('Could not create merchant review:', merchantReviewError);
        } else {
          // تحديث تقييم المتجر
          await updateMerchantRating(order.merchant_id);
        }
      }

      // تحديث حالة الطلب لتحديد أن التقييم تم
      const { error: orderUpdateError } = await supabase
        .from('orders')
        .update({ rating: rating, review_text: comment.trim() })
        .eq('id', id);

      if (orderUpdateError) {
        console.warn('Could not update order rating:', orderUpdateError);
      }

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
    } catch (error) {
      console.error('Error submitting rating:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال التقييم');
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