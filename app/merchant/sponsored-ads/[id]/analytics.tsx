import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Eye, MousePointer, TrendingUp, ShoppingCart, DollarSign, Calendar } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

interface AdDetails {
  id: string;
  merchant_id: string;
  ad_type: string;
  title: string;
  description: string;
  image_url: string;
  is_active: boolean;
  start_date: string;
  end_date: string;
  budget_amount: number;
  total_spent: number;
  impression_count: number;
  click_count: number;
  conversion_count: number;
}

interface Analytics {
  impressions: number;
  clicks: number;
  conversions: number;
  ctr: number;
  conversion_rate: number;
  total_spent: number;
  roi: number;
}

export default function AdAnalyticsScreen() {
  const { id } = useLocalSearchParams();
  const adId = Array.isArray(id) ? id[0] : id;
  const [ad, setAd] = useState<AdDetails | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    if (adId) {
      fetchAdDetails();
    }
  }, [adId]);

  useEffect(() => {
    if (adId && ad?.merchant_id) {
      fetchAnalytics();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adId, ad?.merchant_id, timeRange]);

  const fetchAdDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('sponsored_ads')
        .select('id, merchant_id, ad_type, title, description, image_url, is_active, start_date, end_date, budget_amount, total_spent, impression_count, click_count, conversion_count')
        .eq('id', adId)
        .maybeSingle();

      if (error) throw error;
      if (data) setAd(data as AdDetails); else setAd(null);
    } catch (error) {
      console.error('Error fetching ad:', error);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);

      // Calculate date range
      let startDate = new Date();
      if (timeRange === '7d') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === '30d') {
        startDate.setDate(startDate.getDate() - 30);
      } else {
        startDate = new Date(0); // All time
      }
      const endDate = new Date();

      // Use aggregated analytics RPC and pick the current ad
      const { data: rows, error } = await supabase.rpc('get_ad_analytics', {
        p_merchant_id: ad!.merchant_id,
        p_start_date: startDate.toISOString(),
        p_end_date: endDate.toISOString(),
      });
      if (error) throw error;

      const row = Array.isArray(rows) ? rows.find((r: any) => r.ad_id === adId) : null;

      if (row) {
        const ctr = row.ctr || 0;
        const conversionRate = row.conversion_rate || 0;
        const totalSpent = row.total_spent || 0;
        setAnalytics({
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          conversions: row.conversions || 0,
          ctr,
          conversion_rate: conversionRate,
          total_spent: totalSpent,
          roi: row.roi || 0,
        });
      } else if (ad) {
        // Fallback to counters on the ad row
        const ctr = ad.impression_count > 0 ? (ad.click_count / ad.impression_count) * 100 : 0;
        const conversionRate = ad.click_count > 0 ? (ad.conversion_count / ad.click_count) * 100 : 0;
        const estimatedRevenue = ad.conversion_count * 100;
        const roi = ad.total_spent > 0 ? ((estimatedRevenue - ad.total_spent) / ad.total_spent) * 100 : 0;
        setAnalytics({
          impressions: ad.impression_count || 0,
          clicks: ad.click_count || 0,
          conversions: ad.conversion_count || 0,
          ctr,
          conversion_rate: conversionRate,
          total_spent: ad.total_spent || 0,
          roi,
        });
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const getDaysRemaining = () => {
    if (!ad) return 0;
    const endDate = new Date(ad.end_date);
    const today = new Date();
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  const getStatusColor = () => {
    if (!ad) return colors.textLight;
    if (!ad.is_active) return colors.error;
    if (ad.total_spent >= ad.budget_amount) return colors.warning;
    return colors.success;
  };

  const getStatusText = () => {
    if (!ad) return '';
    if (!ad.is_active) return 'متوقف';
    if (ad.total_spent >= ad.budget_amount) return 'نفذت الميزانية';
    if (getDaysRemaining() === 0) return 'انتهى';
    return 'نشط';
  };

  if (loading && !ad) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!ad) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>لم يتم العثور على الإعلان</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/merchant/sponsored-ads' as any)} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تحليلات الإعلان</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Ad Info Card */}
        <View style={styles.adInfoCard}>
          <View style={styles.adInfoHeader}>
            <Text style={styles.adTitle}>{ad.title}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor() + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
            </View>
          </View>
          
          <View style={styles.adInfoRow}>
            <View style={styles.adInfoItem}>
              <Calendar size={16} color={colors.textLight} />
              <Text style={styles.adInfoText}>
                {formatDate(ad.start_date)} - {formatDate(ad.end_date)}
              </Text>
            </View>
          </View>

          <View style={styles.daysRemaining}>
            <Text style={styles.daysRemainingText}>
              {getDaysRemaining() > 0 ? `${getDaysRemaining()} يوم متبقي` : 'انتهى الإعلان'}
            </Text>
          </View>
        </View>

        {/* Time Range Selector */}
        <View style={styles.timeRangeContainer}>
          <TouchableOpacity
            style={[styles.timeRangeButton, timeRange === '7d' && styles.timeRangeButtonActive]}
            onPress={() => setTimeRange('7d')}
          >
            <Text style={[styles.timeRangeText, timeRange === '7d' && styles.timeRangeTextActive]}>
              7 أيام
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeRangeButton, timeRange === '30d' && styles.timeRangeButtonActive]}
            onPress={() => setTimeRange('30d')}
          >
            <Text style={[styles.timeRangeText, timeRange === '30d' && styles.timeRangeTextActive]}>
              30 يوم
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.timeRangeButton, timeRange === 'all' && styles.timeRangeButtonActive]}
            onPress={() => setTimeRange('all')}
          >
            <Text style={[styles.timeRangeText, timeRange === 'all' && styles.timeRangeTextActive]}>
              الكل
            </Text>
          </TouchableOpacity>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={[styles.metricCard, { backgroundColor: '#4ECDC4' + '15' }]}>
            <Eye size={28} color="#4ECDC4" />
            <Text style={styles.metricValue}>{analytics?.impressions.toLocaleString() || 0}</Text>
            <Text style={styles.metricLabel}>مشاهدات</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#FF6B6B' + '15' }]}>
            <MousePointer size={28} color="#FF6B6B" />
            <Text style={styles.metricValue}>{analytics?.clicks.toLocaleString() || 0}</Text>
            <Text style={styles.metricLabel}>نقرات</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#45B7D1' + '15' }]}>
            <TrendingUp size={28} color="#45B7D1" />
            <Text style={styles.metricValue}>{analytics?.ctr.toFixed(2) || 0}%</Text>
            <Text style={styles.metricLabel}>CTR</Text>
          </View>

          <View style={[styles.metricCard, { backgroundColor: '#FFD700' + '15' }]}>
            <ShoppingCart size={28} color="#FFD700" />
            <Text style={styles.metricValue}>{analytics?.conversions || 0}</Text>
            <Text style={styles.metricLabel}>طلبات</Text>
          </View>

          {/* Spent */}
          <View style={[styles.metricCard, { backgroundColor: '#8E44AD' + '15' }]}>
            <DollarSign size={28} color="#8E44AD" />
            <Text style={styles.metricValue}>{(analytics?.total_spent || 0).toFixed(0)} ج</Text>
            <Text style={styles.metricLabel}>الإنفاق</Text>
          </View>

          {/* ROI */}
          <View style={[styles.metricCard, { backgroundColor: '#2ECC71' + '15' }]}>
            <TrendingUp size={28} color="#2ECC71" />
            <Text style={styles.metricValue}>{(analytics?.roi || 0).toFixed(2)}%</Text>
            <Text style={styles.metricLabel}>ROI</Text>
          </View>
        </View>

        {/* Performance Card */}
        <View style={styles.performanceCard}>
          <Text style={styles.cardTitle}>📊 الأداء</Text>
          
          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>معدل التحويل:</Text>
            <Text style={styles.performanceValue}>{analytics?.conversion_rate.toFixed(2)}%</Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    width: `${Math.min(analytics?.conversion_rate || 0, 100)}%`,
                    backgroundColor: colors.success,
                  }
                ]} 
              />
            </View>
          </View>

          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>متوسط تكلفة النقرة:</Text>
            <Text style={styles.performanceValue}>
              {analytics?.clicks ? (analytics.total_spent / analytics.clicks).toFixed(2) : 0} ج
            </Text>
          </View>

          <View style={styles.performanceRow}>
            <Text style={styles.performanceLabel}>تكلفة الطلب:</Text>
            <Text style={styles.performanceValue}>
              {analytics?.conversions ? (analytics.total_spent / analytics.conversions).toFixed(2) : 0} ج
            </Text>
          </View>
        </View>

        {/* Budget Card */}
        <View style={styles.budgetCard}>
          <Text style={styles.cardTitle}>💰 الميزانية</Text>
          
          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>الميزانية الكلية:</Text>
            <Text style={styles.budgetValue}>{ad.budget_amount.toFixed(0)} ج</Text>
          </View>

          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>المُنفق:</Text>
            <Text style={[styles.budgetValue, { color: colors.error }]}>
              {analytics?.total_spent.toFixed(2)} ج
            </Text>
          </View>

          <View style={styles.budgetRow}>
            <Text style={styles.budgetLabel}>المتبقي:</Text>
            <Text style={[styles.budgetValue, { color: colors.success }]}>
              {(ad.budget_amount - (analytics?.total_spent || 0)).toFixed(2)} ج
            </Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill,
                  { 
                    width: `${Math.min(((analytics?.total_spent || 0) / ad.budget_amount) * 100, 100)}%`,
                    backgroundColor: 
                      (analytics?.total_spent || 0) >= ad.budget_amount 
                        ? colors.error 
                        : colors.primary,
                  }
                ]} 
              />
            </View>
          </View>

          <Text style={styles.budgetPercentage}>
            {(((analytics?.total_spent || 0) / ad.budget_amount) * 100).toFixed(1)}% من الميزانية
          </Text>
        </View>

        {/* ROI Card */}
        <View style={styles.roiCard}>
          <Text style={styles.cardTitle}>📈 العائد على الاستثمار (ROI)</Text>
          
          <View style={styles.roiValueContainer}>
            <DollarSign size={48} color={analytics && analytics.roi >= 0 ? colors.success : colors.error} />
            <Text style={[
              styles.roiValue,
              { color: analytics && analytics.roi >= 0 ? colors.success : colors.error }
            ]}>
              {analytics?.roi.toFixed(1)}%
            </Text>
          </View>

          <Text style={styles.roiDescription}>
            {analytics && analytics.roi >= 0 
              ? '✅ الإعلان يحقق عائد إيجابي'
              : '⚠️ الإعلان يحتاج تحسين'
            }
          </Text>

          <View style={styles.roiBreakdown}>
            <View style={styles.roiRow}>
              <Text style={styles.roiLabel}>الإيرادات المقدرة:</Text>
              <Text style={styles.roiValue2}>
                {analytics?.conversions ? (analytics.conversions * 100).toFixed(0) : 0} ج
              </Text>
            </View>
            <View style={styles.roiRow}>
              <Text style={styles.roiLabel}>التكلفة:</Text>
              <Text style={styles.roiValue2}>{analytics?.total_spent.toFixed(0)} ج</Text>
            </View>
            <View style={styles.roiDivider} />
            <View style={styles.roiRow}>
              <Text style={styles.roiLabelBold}>الربح الصافي:</Text>
              <Text style={[
                styles.roiValueBold,
                { color: analytics && (analytics.conversions * 100 - analytics.total_spent) >= 0 ? colors.success : colors.error }
              ]}>
                {analytics ? ((analytics.conversions * 100) - analytics.total_spent).toFixed(0) : 0} ج
              </Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsCard}>
          <Text style={styles.cardTitle}>💡 نصائح لتحسين الأداء</Text>
          
          {analytics && analytics.ctr < 2 && (
            <Text style={styles.tipText}>• معدل النقر منخفض - جرب تغيير الصورة أو العنوان</Text>
          )}
          
          {analytics && analytics.conversion_rate < 5 && (
            <Text style={styles.tipText}>• معدل التحويل منخفض - تأكد من أسعارك التنافسية</Text>
          )}
          
          {analytics && analytics.roi < 0 && (
            <Text style={styles.tipText}>• العائد سلبي - قلل الميزانية أو استهدف جمهور أفضل</Text>
          )}
          
          {analytics && analytics.ctr >= 2 && analytics.conversion_rate >= 5 && (
            <Text style={styles.tipText}>✅ أداء ممتاز! استمر بنفس الاستراتيجية</Text>
          )}
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
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    ...typography.h3,
    color: colors.textLight,
  },
  adInfoCard: {
    backgroundColor: colors.white,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  adInfoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  adTitle: {
    ...typography.h3,
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '600',
  },
  adInfoRow: {
    marginBottom: spacing.sm,
  },
  adInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  adInfoText: {
    ...typography.body,
    color: colors.textLight,
  },
  daysRemaining: {
    backgroundColor: colors.primary + '10',
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginTop: spacing.sm,
  },
  daysRemainingText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    textAlign: 'center',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  timeRangeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeRangeText: {
    ...typography.body,
    color: colors.text,
  },
  timeRangeTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  metricCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  metricValue: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  performanceCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  cardTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  performanceLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  performanceValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
  },
  progressBarContainer: {
    marginVertical: spacing.md,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  budgetCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  budgetLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  budgetValue: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
  },
  budgetPercentage: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  roiCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  roiValueContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
    marginVertical: spacing.lg,
  },
  roiValue: {
    ...typography.h1,
    fontWeight: '700',
  },
  roiDescription: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  roiBreakdown: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  roiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  roiLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  roiValue2: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
  },
  roiDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  roiLabelBold: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  roiValueBold: {
    ...typography.h3,
    fontWeight: '700',
  },
  tipsCard: {
    backgroundColor: colors.secondary + '10',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.xxl,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  tipText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.sm,
    lineHeight: 22,
  },
});
