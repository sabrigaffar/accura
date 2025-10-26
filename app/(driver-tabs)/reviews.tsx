import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Star, Calendar } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  order_number: string;
  reviewer_name: string;
}

export default function DriverReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  });

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      setLoading(true);

      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          order:orders!reviews_order_id_fkey (
            order_number
          ),
          reviewer:profiles!reviews_reviewer_id_fkey (
            full_name
          )
        `)
        .eq('reviewee_id', user?.id)
        .eq('reviewee_type', 'driver')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedReviews = reviewsData.map((review: any) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        order_number: review.order?.order_number || '',
        reviewer_name: review.reviewer?.full_name || 'عميل',
      }));

      setReviews(formattedReviews);
      calculateStats(formattedReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStats = (reviewsData: Review[]) => {
    const total = reviewsData.length;
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    reviewsData.forEach((review) => {
      distribution[review.rating as keyof typeof distribution]++;
      sum += review.rating;
    });

    setStats({
      totalReviews: total,
      averageRating: total > 0 ? sum / total : 0,
      ratingDistribution: distribution,
    });
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchReviews();
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            color={star <= rating ? colors.warning : colors.border}
            fill={star <= rating ? colors.warning : 'transparent'}
          />
        ))}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>تقييماتي</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>تقييماتي</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.averageRatingSection}>
            <Text style={styles.averageRatingNumber}>
              {stats.averageRating.toFixed(1)}
            </Text>
            {renderStars(Math.round(stats.averageRating))}
            <Text style={styles.totalReviews}>
              ({stats.totalReviews} تقييم)
            </Text>
          </View>

          {/* Rating Distribution */}
          <View style={styles.distributionSection}>
            {[5, 4, 3, 2, 1].map((star) => (
              <View key={star} style={styles.distributionRow}>
                <Text style={styles.distributionStar}>{star}</Text>
                <Star size={12} color={colors.warning} fill={colors.warning} />
                <View style={styles.distributionBar}>
                  <View
                    style={[
                      styles.distributionBarFill,
                      {
                        width: `${
                          stats.totalReviews > 0
                            ? (stats.ratingDistribution[star as keyof typeof stats.ratingDistribution] /
                                stats.totalReviews) *
                              100
                            : 0
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.distributionCount}>
                  {stats.ratingDistribution[star as keyof typeof stats.ratingDistribution]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Reviews List */}
        {reviews.length === 0 ? (
          <View style={styles.emptyState}>
            <Star size={48} color={colors.textLight} />
            <Text style={styles.emptyStateText}>لا توجد تقييمات بعد</Text>
            <Text style={styles.emptyStateSubtext}>
              قم بتوصيل المزيد من الطلبات للحصول على تقييمات
            </Text>
          </View>
        ) : (
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.reviewerAvatar}>
                      <Text style={styles.reviewerInitial}>
                        {review.reviewer_name.charAt(0)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
                      <Text style={styles.orderNumber}>طلب #{review.order_number}</Text>
                    </View>
                  </View>
                  {renderStars(review.rating)}
                </View>

                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}

                <View style={styles.reviewFooter}>
                  <Calendar size={12} color={colors.textLight} />
                  <Text style={styles.reviewDate}>
                    {new Date(review.created_at).toLocaleDateString('ar-SA')}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
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
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsCard: {
    backgroundColor: colors.white,
    padding: spacing.xl,
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  averageRatingSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  averageRatingNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  totalReviews: {
    ...typography.caption,
    color: colors.textLight,
  },
  distributionSection: {
    marginTop: spacing.lg,
  },
  distributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  distributionStar: {
    ...typography.caption,
    color: colors.text,
    width: 12,
  },
  distributionBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  distributionBarFill: {
    height: '100%',
    backgroundColor: colors.warning,
  },
  distributionCount: {
    ...typography.caption,
    color: colors.textLight,
    width: 30,
    textAlign: 'right',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl * 2,
  },
  emptyStateText: {
    ...typography.h3,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  emptyStateSubtext: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  reviewsList: {
    backgroundColor: colors.white,
  },
  reviewCard: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  reviewerInitial: {
    ...typography.h3,
    color: colors.primary,
  },
  reviewerName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  orderNumber: {
    ...typography.caption,
    color: colors.textLight,
  },
  reviewComment: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.md,
    lineHeight: 22,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  reviewDate: {
    ...typography.caption,
    color: colors.textLight,
  },
});
