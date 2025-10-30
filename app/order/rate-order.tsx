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
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Send } from 'lucide-react-native';
import { RatingStars } from '@/components/RatingStars';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function RateOrderScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = theme;
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  
  const params = useLocalSearchParams<{
    orderId: string;
    driverName: string;
    merchantName: string;
    driverId: string;
    merchantId: string;
  }>();

  const [driverRating, setDriverRating] = useState(0);
  const [merchantRating, setMerchantRating] = useState(0);
  const [driverComment, setDriverComment] = useState('');
  const [merchantComment, setMerchantComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (driverRating === 0 && merchantRating === 0) {
      Alert.alert('تنبيه', 'يرجى تقييم السائق أو المتجر على الأقل');
      return;
    }

    try {
      setSubmitting(true);

      const reviews = [];

      // تقييم السائق
      if (driverRating > 0 && params.driverId) {
        reviews.push({
          order_id: params.orderId,
          reviewer_id: user?.id,
          reviewee_id: params.driverId,
          reviewee_type: 'driver',
          rating: driverRating,
          comment: driverComment.trim() || null,
        });
      }

      // تقييم المتجر
      if (merchantRating > 0 && params.merchantId) {
        reviews.push({
          order_id: params.orderId,
          reviewer_id: user?.id,
          reviewee_id: params.merchantId,
          reviewee_type: 'merchant',
          rating: merchantRating,
          comment: merchantComment.trim() || null,
        });
      }

      // إدراج التقييمات
      const { error } = await supabase.from('reviews').insert(reviews);

      if (error) throw error;

      // تحديث متوسط التقييم
      if (driverRating > 0 && params.driverId) {
        await updateDriverRating(params.driverId);
      }

      Alert.alert('شكراً لك! 🎉', 'تم إرسال تقييمك بنجاح', [
        {
          text: 'موافق',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error submitting review:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال التقييم');
    } finally {
      setSubmitting(false);
    }
  };

  const updateDriverRating = async (driverId: string) => {
    try {
      // حساب متوسط التقييم الجديد
      const { data: reviews } = await supabase
        .from('reviews')
        .select('rating')
        .eq('reviewee_id', driverId)
        .eq('reviewee_type', 'driver');

      if (reviews && reviews.length > 0) {
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        
        // تحديث driver_profiles
        await supabase
          .from('driver_profiles')
          .update({ average_rating: avgRating.toFixed(1) })
          .eq('id', driverId);
      }
    } catch (error) {
      console.error('Error updating driver rating:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تقييم الطلب</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* تقييم السائق */}
        {params.driverName && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>قيّم السائق</Text>
              <Text style={styles.personName}>{params.driverName}</Text>
            </View>

            <View style={styles.ratingContainer}>
              <RatingStars
                rating={driverRating}
                onRatingChange={setDriverRating}
                size={40}
                showLabel
                style={styles.stars}
              />
            </View>

            {driverRating > 0 && (
              <TextInput
                style={styles.commentInput}
                placeholder="أضف تعليقاً (اختياري)"
                placeholderTextColor={colors.textLight}
                value={driverComment}
                onChangeText={setDriverComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          </View>
        )}

        {/* تقييم المتجر */}
        {params.merchantName && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>قيّم المتجر</Text>
              <Text style={styles.personName}>{params.merchantName}</Text>
            </View>

            <View style={styles.ratingContainer}>
              <RatingStars
                rating={merchantRating}
                onRatingChange={setMerchantRating}
                size={40}
                showLabel
                style={styles.stars}
              />
            </View>

            {merchantRating > 0 && (
              <TextInput
                style={styles.commentInput}
                placeholder="أضف تعليقاً (اختياري)"
                placeholderTextColor={colors.textLight}
                value={merchantComment}
                onChangeText={setMerchantComment}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            )}
          </View>
        )}

        {/* نصائح */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 نصائح للتقييم:</Text>
          <Text style={styles.tipText}>• كن منصفاً وموضوعياً في تقييمك</Text>
          <Text style={styles.tipText}>• ساعد الآخرين باختيار أفضل خدمة</Text>
          <Text style={styles.tipText}>• تجنب الكلمات المسيئة</Text>
        </View>
      </ScrollView>

      {/* زر الإرسال */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            (driverRating === 0 && merchantRating === 0) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={submitting || (driverRating === 0 && merchantRating === 0)}
        >
          {submitting ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Send size={20} color={colors.white} />
              <Text style={styles.submitButtonText}>إرسال التقييم</Text>
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
      backgroundColor: colors.card,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      marginBottom: spacing.lg,
    },
    sectionHeader: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      ...typography.h3,
      color: colors.text,
      marginBottom: spacing.xs,
    },
    personName: {
      ...typography.body,
      color: colors.textSecondary,
    },
    ratingContainer: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
    },
    stars: {
      // Custom styles if needed
    },
    commentInput: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.md,
      padding: spacing.md,
      color: colors.text,
      ...typography.body,
      minHeight: 100,
      marginTop: spacing.md,
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
