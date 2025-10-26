import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Star, Store, Truck } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function RateOrder() {
  const { orderId } = useLocalSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<any>(null);
  
  // Merchant Rating
  const [merchantRating, setMerchantRating] = useState(0);
  const [merchantComment, setMerchantComment] = useState('');
  
  // Driver Rating
  const [driverRating, setDriverRating] = useState(0);
  const [driverComment, setDriverComment] = useState('');

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          merchant_id,
          driver_id,
          merchants:merchants!orders_merchant_id_fkey (
            id,
            name_ar
          )
        `)
        .eq('id', orderId)
        .single();

      if (error) throw error;
      setOrder(data);
    } catch (error) {
      console.error('Error fetching order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل بيانات الطلب');
    }
  };

  const handleSubmit = async () => {
    if (merchantRating === 0 && driverRating === 0) {
      Alert.alert('تنبيه', 'يرجى إضافة تقييم واحد على الأقل');
      return;
    }

    try {
      setLoading(true);

      const reviews = [];

      // Merchant Review
      if (merchantRating > 0) {
        reviews.push({
          order_id: orderId,
          reviewer_id: user?.id,
          reviewee_id: order.merchant_id,
          reviewee_type: 'merchant',
          rating: merchantRating,
          comment: merchantComment.trim() || null,
        });
      }

      // Driver Review
      if (driverRating > 0 && order.driver_id) {
        reviews.push({
          order_id: orderId,
          reviewer_id: user?.id,
          reviewee_id: order.driver_id,
          reviewee_type: 'driver',
          rating: driverRating,
          comment: driverComment.trim() || null,
        });
      }

      const { error } = await supabase.from('reviews').insert(reviews);

      if (error) throw error;

      Alert.alert('شكراً!', 'تم إرسال تقييمك بنجاح', [
        {
          text: 'حسناً',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Error submitting reviews:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال التقييم');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating: number, setRating: (rating: number) => void) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity key={star} onPress={() => setRating(star)}>
            <Star
              size={32}
              color={star <= rating ? colors.warning : colors.border}
              fill={star <= rating ? colors.warning : 'transparent'}
              style={styles.star}
            />
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  if (!order) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
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
        <Text style={styles.headerTitle}>تقييم الطلب</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content}>
        {/* Order Info */}
        <View style={styles.orderInfo}>
          <Text style={styles.orderNumber}>طلب #{order.order_number}</Text>
          <Text style={styles.orderSubtitle}>شكراً لطلبك! نتمنى أن تشاركنا تقييمك</Text>
        </View>

        {/* Merchant Rating */}
        <View style={styles.ratingSection}>
          <View style={styles.ratingHeader}>
            <View style={styles.ratingIcon}>
              <Store size={24} color={colors.primary} />
            </View>
            <View style={styles.ratingHeaderText}>
              <Text style={styles.ratingTitle}>قيّم المتجر</Text>
              <Text style={styles.ratingSubtitle}>
                {order.merchants?.name_ar || 'المتجر'}
              </Text>
            </View>
          </View>

          {renderStars(merchantRating, setMerchantRating)}

          <TextInput
            style={styles.commentInput}
            placeholder="أضف تعليقك (اختياري)"
            placeholderTextColor={colors.textLight}
            value={merchantComment}
            onChangeText={setMerchantComment}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Driver Rating */}
        {order.driver_id && (
          <View style={styles.ratingSection}>
            <View style={styles.ratingHeader}>
              <View style={styles.ratingIcon}>
                <Truck size={24} color={colors.secondary} />
              </View>
              <View style={styles.ratingHeaderText}>
                <Text style={styles.ratingTitle}>قيّم السائق</Text>
                <Text style={styles.ratingSubtitle}>سائق التوصيل</Text>
              </View>
            </View>

            {renderStars(driverRating, setDriverRating)}

            <TextInput
              style={styles.commentInput}
              placeholder="أضف تعليقك (اختياري)"
              placeholderTextColor={colors.textLight}
              value={driverComment}
              onChangeText={setDriverComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            (merchantRating === 0 && driverRating === 0) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={loading || (merchantRating === 0 && driverRating === 0)}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitButtonText}>إرسال التقييم</Text>
          )}
        </TouchableOpacity>
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
  orderInfo: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderNumber: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  orderSubtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
  ratingSection: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    marginTop: spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  ratingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ratingIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  ratingHeaderText: {
    flex: 1,
  },
  ratingTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  ratingSubtitle: {
    ...typography.body,
    color: colors.textLight,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  star: {
    marginHorizontal: spacing.xs,
  },
  commentInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 80,
    backgroundColor: colors.background,
  },
  submitButton: {
    backgroundColor: colors.primary,
    margin: spacing.xl,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.border,
  },
  submitButtonText: {
    ...typography.h3,
    color: colors.white,
  },
});
