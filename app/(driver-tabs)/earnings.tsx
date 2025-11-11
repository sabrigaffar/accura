import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { TrendingUp, DollarSign, Package, Calendar } from 'lucide-react-native';
import { spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCurrency, DEFAULT_CURRENCY, getCurrencyByCode } from '@/constants/currencies';
import { getBaseFeePerKmCached, refreshBaseFeePerKm } from '@/lib/deliveryFeeCalculator';

interface Earning {
  id: string;
  order_number: string;
  amount: number; // will hold NET amount for display
  net_amount?: number;
  commission_amount?: number;
  earned_at: string;
  customer_name: string;
}

interface EarningsStats {
  today: number;
  week: number;
  month: number;
  total: number;
  deliveries_count: number;
}

export default function DriverEarnings() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const colors = theme; // Make colors dynamic based on theme
  
  // Create styles with dynamic theme colors
  const styles = React.useMemo(() => createStyles(colors), [colors]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [stats, setStats] = useState<EarningsStats>({
    today: 0,
    week: 0,
    month: 0,
    total: 0,
    deliveries_count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY);

  useEffect(() => {
    // تأكد من تحديث كاش سعر الكيلو الديناميكي للعرض الصحيح
    refreshBaseFeePerKm().catch(() => {});
    fetchEarnings();
    fetchCurrency();
  }, []);

  // تحديث العملة والأرباح عند العودة للصفحة
  useFocusEffect(
    React.useCallback(() => {
      fetchCurrency();
      fetchEarnings();
    }, [])
  );

  const fetchCurrency = async () => {
    if (!user?.id) return;
    try {
      const { data } = await supabase
        .from('driver_profiles')
        .select('preferred_currency')
        .eq('id', user.id)
        .single();
      if (data?.preferred_currency) {
        setCurrency(data.preferred_currency);
      }
    } catch (e) {
      console.error('fetch currency error:', e);
    }
  };

  const fetchEarnings = async () => {
    try {
      setLoading(true);

      if (!user) {
        setLoading(false);
        return;
      }

      // حاول أولاً القراءة من العرض driver_earnings_effective (الأكثر موثوقية)
      let earningsRows: any[] | null = null;
      const ve = await supabase
        .from('driver_earnings_effective')
        .select('id, effective_amount, net_amount, commission_amount, earned_at, order_number, customer_name')
        .order('earned_at', { ascending: false });

      if (ve.error) {
        // إذا كان العرض غير موجود (42P01) أو خطأ أعمدة، استخدم الاستعلام التقليدي كاحتياطي
        const code = (ve.error as any).code;
        if (code === '42P01' || code === '42703') {
          const q1 = await supabase
            .from('driver_earnings')
            .select(`
              id,
              amount,
              net_amount,
              commission_amount,
              earned_at,
              created_at,
              order:orders!driver_earnings_order_id_fkey (
                order_number,
                delivery_fee,
                calculated_delivery_fee,
                delivery_distance_km,
                customer:profiles!orders_customer_id_fkey (
                  full_name
                )
              )
            `)
            .eq('driver_id', user.id)
            .order('earned_at', { ascending: false });

          if (q1.error) {
            if ((q1.error as any).code === '42703') {
              const q2 = await supabase
                .from('driver_earnings')
                .select(`
                  id,
                  amount,
                  net_amount,
                  commission_amount,
                  created_at,
                  order:orders!driver_earnings_order_id_fkey (
                    order_number,
                    delivery_fee,
                    calculated_delivery_fee,
                    delivery_distance_km,
                    customer:profiles!orders_customer_id_fkey (
                      full_name
                    )
                  )
                `)
                .eq('driver_id', user.id)
                .order('created_at', { ascending: false });
              if (q2.error) throw q2.error;
              earningsRows = q2.data as any[];
            } else {
              throw q1.error;
            }
          } else {
            earningsRows = q1.data as any[];
          }
        } else {
          throw ve.error;
        }
      } else {
        // تم إرجاع البيانات من العرض مباشرة
        earningsRows = (ve.data as any[]).map((r) => ({
          id: r.id,
          amount: r.effective_amount,
          net_amount: r.net_amount,
          commission_amount: r.commission_amount,
          earned_at: r.earned_at,
          created_at: r.earned_at,
          order: { order_number: r.order_number, customer: { full_name: r.customer_name } },
        }));
      }

      // معالجة البيانات
      try {
        console.log('[EARNINGS] raw rows count:', (earningsRows || []).length);
        console.log('[EARNINGS] raw sample:', (earningsRows || [])[0]);
      } catch {}
      const processedEarnings: Earning[] = (earningsRows || []).map((earning: any) => {
        const order = Array.isArray(earning.order) ? earning.order[0] : earning.order;
        const customer = order?.customer ? (Array.isArray(order.customer) ? order.customer[0] : order.customer) : null;
        const KM_FEE = getBaseFeePerKmCached(); // مطابق لإعدادات المنصة ديناميكياً
        const orderDeliveryFee = Number(order?.delivery_fee ?? 0);
        const orderCalculatedFee = Number(order?.calculated_delivery_fee ?? 0);
        const orderDistanceKm = order?.delivery_distance_km !== undefined && order?.delivery_distance_km !== null
          ? Number(order.delivery_distance_km)
          : NaN;

        const distanceFee = !isNaN(orderDistanceKm) ? Math.ceil(orderDistanceKm) * KM_FEE : 0;

        let gross = Number(earning.amount ?? 0);
        if (!gross || gross <= 0) {
          // fallback إلى قيم الطلب إذا كان amount = 0 في السجل
          gross = Math.max(orderDeliveryFee || 0, orderCalculatedFee || 0, distanceFee || 0, 0);
        }

        const commission = Number(earning.commission_amount ?? 0);
        const netFromDb = (earning.net_amount !== null && earning.net_amount !== undefined)
          ? Number(earning.net_amount)
          : NaN;
        let net = (isFinite(netFromDb) && netFromDb > 0)
          ? netFromDb
          : Math.max(gross - commission, 0);
        // نهائي: إذا بقي صفر أو أقل بينما gross>0، اعرض gross لضمان عدم إظهار 0 خطأً
        if (!isFinite(net) || net <= 0) {
          net = gross > 0 ? gross : 0;
        }

        return {
          id: earning.id,
          order_number: order?.order_number || 'غير معروف',
          amount: net, // display NET amount with UI fallback
          net_amount: net,
          commission_amount: commission,
          earned_at: earning.earned_at || earning.created_at,
          customer_name: customer?.full_name || 'عميل',
        };
      });

      try {
        console.log('[EARNINGS] processed sample:', processedEarnings[0]);
        console.log('[EARNINGS] totals today/week/month/all before set:',
          processedEarnings.reduce((s, e) => s + e.amount, 0)
        );
      } catch {}
      setEarnings(processedEarnings);

      // حساب الإحصائيات
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const todayEarnings = processedEarnings.filter(
        (e) => new Date(e.earned_at) >= todayStart
      );
      const weekEarnings = processedEarnings.filter(
        (e) => new Date(e.earned_at) >= weekStart
      );
      const monthEarnings = processedEarnings.filter(
        (e) => new Date(e.earned_at) >= monthStart
      );

      setStats({
        today: todayEarnings.reduce((sum, e) => sum + e.amount, 0),
        week: weekEarnings.reduce((sum, e) => sum + e.amount, 0),
        month: monthEarnings.reduce((sum, e) => sum + e.amount, 0),
        total: processedEarnings.reduce((sum, e) => sum + e.amount, 0),
        deliveries_count: processedEarnings.length,
      });
    } catch (error) {
      console.error('Error fetching earnings:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEarnings();
  };

  const getFilteredEarnings = () => {
    const now = new Date();
    switch (selectedPeriod) {
      case 'today':
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return earnings.filter((e) => new Date(e.earned_at) >= todayStart);
      case 'week':
        const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return earnings.filter((e) => new Date(e.earned_at) >= weekStart);
      case 'month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        return earnings.filter((e) => new Date(e.earned_at) >= monthStart);
      default:
        return earnings;
    }
  };

  const getLast7DaysEarnings = () => {
    const result: { day: string; amount: number; date: Date }[] = [];
    const now = new Date();
    const dayNames = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];

    // إنشاء مصفوفة لآخر 7 أيام
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const dayEarnings = earnings.filter((e) => {
        const earnDate = new Date(e.earned_at);
        earnDate.setHours(0, 0, 0, 0);
        return earnDate.getTime() === date.getTime();
      });

      const totalAmount = dayEarnings.reduce((sum, e) => sum + e.amount, 0);
      
      result.push({
        day: i === 0 ? 'اليوم' : dayNames[date.getDay()],
        amount: totalAmount,
        date: date,
      });
    }

    return result;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-SA', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderEarningItem = ({ item }: { item: Earning }) => (
    <View style={styles.earningCard}>
      <View style={styles.earningHeader}>
        <View style={styles.orderInfo}>
          <Package size={16} color={colors.textLight} />
          <Text style={styles.orderNumber}>#{item.order_number}</Text>
        </View>
        <View style={styles.amountBadge}>
          <DollarSign size={16} color={colors.success} />
          <Text style={styles.amountText}>{formatCurrency(item.amount, currency)}</Text>
        </View>
      </View>
      <Text style={styles.customerName}>{item.customer_name}</Text>
      {/* Breakdown: gross / commission / net */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
        <Text style={{ color: colors.textLight }}>
          إجمالي: {formatCurrency((item.net_amount ?? item.amount) + (item.commission_amount ?? 0), currency)}
        </Text>
        <Text style={{ color: colors.textLight }}>
          خصم: {formatCurrency(item.commission_amount ?? 0, currency)}
        </Text>
        <Text style={{ color: colors.text }}>
          صافي: {formatCurrency(item.net_amount ?? item.amount, currency)}
        </Text>
      </View>
      <View style={styles.dateRow}>
        <Calendar size={14} color={colors.textLight} />
        <Text style={styles.dateText}>{formatDate(item.earned_at)}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>أرباحي</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const filteredEarnings = getFilteredEarnings();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>أرباحي</Text>
        <Text style={styles.headerSubtitle}>
          {stats.deliveries_count} توصيلة مكتملة
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {/* Earnings Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>أرباح آخر 7 أيام</Text>
          <View style={styles.chart}>
            {getLast7DaysEarnings().map((dayData, index) => {
              const chartData = getLast7DaysEarnings();
              const maxEarning = Math.max(...chartData.map(d => d.amount), 1);
              const heightPercent = (dayData.amount / maxEarning) * 100;
              
              return (
                <View key={index} style={styles.chartBarContainer}>
                  <View style={styles.chartBarWrapper}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: `${Math.max(heightPercent, 5)}%` },
                      ]}
                    >
                      {dayData.amount > 0 && (
                        <Text style={styles.chartBarValue}>
                          {dayData.amount.toFixed(0)}
                        </Text>
                      )}
                    </View>
                  </View>
                  <Text style={styles.chartBarLabel}>{dayData.day}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>اليوم</Text>
              <Text style={styles.statValue}>{stats.today.toFixed(2)}</Text>
              <Text style={styles.statUnit}>{getCurrencyByCode(currency).symbol}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>هذا الأسبوع</Text>
              <Text style={styles.statValue}>{stats.week.toFixed(2)}</Text>
              <Text style={styles.statUnit}>{getCurrencyByCode(currency).symbol}</Text>
            </View>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>هذا الشهر</Text>
              <Text style={styles.statValue}>{stats.month.toFixed(2)}</Text>
              <Text style={styles.statUnit}>{getCurrencyByCode(currency).symbol}</Text>
            </View>
            <View style={[styles.statCard, styles.totalCard]}>
              <TrendingUp size={20} color={colors.primary} />
              <Text style={styles.statLabel}>الإجمالي</Text>
              <Text style={[styles.statValue, styles.totalValue]}>{stats.total.toFixed(2)}</Text>
              <Text style={styles.statUnit}>{getCurrencyByCode(currency).symbol}</Text>
            </View>
          </View>
        </View>

        {/* Period Filter */}
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedPeriod === 'today' && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedPeriod('today')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedPeriod === 'today' && styles.filterButtonTextActive,
                ]}
              >
                اليوم
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedPeriod === 'week' && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedPeriod('week')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedPeriod === 'week' && styles.filterButtonTextActive,
                ]}
              >
                هذا الأسبوع
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedPeriod === 'month' && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedPeriod('month')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedPeriod === 'month' && styles.filterButtonTextActive,
                ]}
              >
                هذا الشهر
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.filterButton,
                selectedPeriod === 'all' && styles.filterButtonActive,
              ]}
              onPress={() => setSelectedPeriod('all')}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  selectedPeriod === 'all' && styles.filterButtonTextActive,
                ]}
              >
                الكل
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Earnings List */}
        <View style={styles.earningsListContainer}>
          <Text style={styles.sectionTitle}>سجل الأرباح</Text>
          {filteredEarnings.length === 0 ? (
            <View style={styles.emptyState}>
              <TrendingUp size={48} color={colors.textLight} />
              <Text style={styles.emptyText}>لا توجد أرباح في هذه الفترة</Text>
            </View>
          ) : (
            <FlatList
              data={filteredEarnings}
              renderItem={renderEarningItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              contentContainerStyle={styles.earningsList}
            />
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
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
  headerSubtitle: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    padding: spacing.md,
    gap: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.small,
  },
  totalCard: {
    backgroundColor: colors.primary + '10',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
  },
  totalValue: {
    color: colors.primary,
  },
  statUnit: {
    ...typography.caption,
    color: colors.textLight,
  },
  filterContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
  },
  filterButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  filterButtonActive: {
    backgroundColor: colors.primary,
  },
  filterButtonText: {
    ...typography.body,
    color: colors.text,
  },
  filterButtonTextActive: {
    color: colors.white,
  },
  earningsListContainer: {
    padding: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  earningsList: {
    gap: spacing.sm,
  },
  earningCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...shadows.small,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  orderNumber: {
    ...typography.body,
    color: colors.text,
  },
  amountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  amountText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  customerName: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  dateText: {
    ...typography.caption,
    color: colors.textLight,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  chartContainer: {
    backgroundColor: colors.white,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    ...shadows.small,
  },
  chartTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    height: 150,
    paddingHorizontal: spacing.sm,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  chartBarWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  chartBar: {
    width: '70%',
    backgroundColor: colors.primary,
    borderTopLeftRadius: borderRadius.sm,
    borderTopRightRadius: borderRadius.sm,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: spacing.xs,
    minHeight: 20,
  },
  chartBarValue: {
    ...typography.caption,
    fontSize: 10,
    color: colors.white,
    fontWeight: 'bold',
  },
  chartBarLabel: {
    ...typography.caption,
    fontSize: 10,
    color: colors.textLight,
    textAlign: 'center',
  },
});
