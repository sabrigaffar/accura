import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tag, Percent } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

type DiscountType = 'flat' | 'percent';
type ApplyOn = 'subtotal' | 'delivery_fee' | 'service_fee' | 'merchant_commission';
type PaymentFilter = 'any' | 'card' | 'cash';

interface Promotion {
  id: string;
  name: string;
  audience: 'customer' | 'merchant' | 'driver' | 'all';
  target_id?: string | null;
  discount_type: DiscountType;
  discount_amount: number;
  start_at: string;
  end_at?: string | null;
  is_active: boolean;
}

interface PromotionRule {
  id: string;
  name: string;
  audience: 'customer' | 'merchant' | 'driver' | 'all';
  store_id?: string | null;
  merchant_category?: string | null;
  discount_type: DiscountType;
  discount_amount: number;
  apply_on: ApplyOn;
  payment_filter: PaymentFilter;
  min_subtotal?: number | null;
  stackable: boolean;
  priority: number;
  is_active: boolean;
  start_at: string;
  end_at?: string | null;
}

interface MerchantLite { id: string; name_ar: string; logo_url?: string | null }

export default function OffersScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rules, setRules] = useState<PromotionRule[]>([]);
  const [merchantsById, setMerchantsById] = useState<Record<string, MerchantLite>>({});
  const [error, setError] = useState<string | null>(null);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('any');

  useEffect(() => {
    const fetchOffers = async () => {
      try {
        setLoading(true);
        setError(null);

        const [promosRes, rulesRes, adsRes] = await Promise.all([
          supabase.from('promotions').select('*').eq('is_active', true),
          supabase.from('promotion_rules').select('*').eq('is_active', true),
          supabase.from('sponsored_ads')
            .select('promotion_rule_id, approval_status, is_active, start_date, end_date')
            .not('promotion_rule_id', 'is', null),
        ]);

        const now = new Date();
        const uid = user?.id;

        // Filter promotions for customer and by time window
        const validPromos = (promosRes.data || []).filter((p: any) => {
          const startOk = p.start_at ? new Date(p.start_at) <= now : true;
          const endOk = !p.end_at || now <= new Date(p.end_at);
          const audienceOk = p.audience === 'all' || p.audience === 'customer';
          const targetOk = !p.target_id || (uid && p.target_id === uid);
          return p.is_active && startOk && endOk && audienceOk && targetOk;
        }).sort((a: any, b: any) => new Date(b.start_at).getTime() - new Date(a.start_at).getTime());

        // Exclude rules that belong to sponsored ads to avoid duplicate appearance
        const adRuleIds = new Set<string>(
          ((adsRes.data as any[]) || [])
            .filter((a: any) => a && a.promotion_rule_id)
            .map((a: any) => String(a.promotion_rule_id))
        );
        const allRules = (rulesRes.data || []) as any[];

        // Filter rules for customer and by time window
        const validRules = allRules.filter((r: any) => {
          const startOk = r.start_at ? new Date(r.start_at) <= now : true;
          const endOk = !r.end_at || now <= new Date(r.end_at);
          const audienceOk = r.audience === 'all' || r.audience === 'customer';
          const notAdLinked = !adRuleIds.has(String(r.id));
          return r.is_active && startOk && endOk && audienceOk && notAdLinked;
        }).sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));

        setPromotions(validPromos);
        setRules(validRules);

        // Fetch merchants for store-specific rules or promos (if target_id refers to store later)
        const storeIds = Array.from(new Set([
          ...validRules.map((r: any) => r.store_id).filter((x: any) => !!x),
        ]));

        if (storeIds.length > 0) {
          const { data: stores } = await supabase
            .from('merchants')
            .select('id, name_ar, logo_url')
            .in('id', storeIds);
          const map: Record<string, MerchantLite> = {};
          (stores || []).forEach((m: any) => { map[m.id] = m; });
          setMerchantsById(map);
        } else {
          setMerchantsById({});
        }
      } catch (e: any) {
        console.error('Error loading offers:', e);
        setError('تعذر تحميل العروض حالياً');
      } finally {
        setLoading(false);
      }
    };

    fetchOffers();
  }, [user?.id]);

  const formatDiscount = (type: DiscountType, amount: number) => {
    if (type === 'percent') return `${amount}%`;
    return `${amount} جنيه`;
  };

  const ruleDescription = (r: PromotionRule) => {
    const d = formatDiscount(r.discount_type, r.discount_amount);
    switch (r.apply_on) {
      case 'subtotal':
        return `خصم ${d} على قيمة الطلب`;
      case 'delivery_fee':
        return `خصم ${d} على رسوم التوصيل`;
      case 'service_fee':
        return `خصم ${d} على رسوم الخدمة`;
      case 'merchant_commission':
        return `خصم ${d} على عمولة التاجر`;
      default:
        return `خصم ${d}`;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>العروض والخصومات</Text>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.loadingText}>جارِ تحميل العروض...</Text>
        </View>
      ) : (
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* مرشّح طريقة الدفع */}
          <View style={styles.filtersRow}>
            <TouchableOpacity
              style={[styles.filterChip, paymentFilter === 'any' && styles.filterChipActive]}
              onPress={() => setPaymentFilter('any')}
            >
              <Text style={[styles.filterChipText, paymentFilter === 'any' && styles.filterChipTextActive]}>الكل</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, paymentFilter === 'cash' && styles.filterChipActive]}
              onPress={() => setPaymentFilter('cash')}
            >
              <Text style={[styles.filterChipText, paymentFilter === 'cash' && styles.filterChipTextActive]}>نقداً</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterChip, paymentFilter === 'card' && styles.filterChipActive]}
              onPress={() => setPaymentFilter('card')}
            >
              <Text style={[styles.filterChipText, paymentFilter === 'card' && styles.filterChipTextActive]}>بطاقة</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.sectionTitle}>عروض عامة</Text>
          {promotions.length === 0 ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>لا توجد عروض عامة حالياً</Text></View>
          ) : promotions.map((p) => (
            <View key={p.id} style={styles.offerCard}>
              <View style={styles.offerIcon}>
                <Percent size={32} color={colors.white} />
              </View>
              <View style={styles.offerContent}>
                <Text style={styles.offerTitle}>{p.name}</Text>
                <Text style={styles.offerDescription}>
                  خصم {formatDiscount(p.discount_type, p.discount_amount)} على قيمة الطلب
                </Text>
                {p.end_at ? (
                  <Text style={styles.offerCode}>متاح حتى {new Date(p.end_at).toLocaleDateString()}</Text>
                ) : null}
              </View>
            </View>
          ))}

          <Text style={[styles.sectionTitle, { marginTop: spacing.lg }]}>قواعد العروض الفعّالة</Text>
          {rules.length === 0 ? (
            <View style={styles.emptyBox}><Text style={styles.emptyText}>لا توجد قواعد عروض سارية</Text></View>
          ) : rules
            .filter(r => paymentFilter === 'any' || r.payment_filter === 'any' || r.payment_filter === paymentFilter)
            .map((r) => (
            <TouchableOpacity
              key={r.id}
              style={styles.offerCard}
              onPress={() => {
                if (r.store_id) {
                  router.push({ pathname: '/merchant/[id]', params: { id: r.store_id } });
                }
              }}
              activeOpacity={r.store_id ? 0.8 : 1}
            >
              <View style={[styles.offerIcon, { backgroundColor: colors.secondary }]}>
                <Tag size={32} color={colors.text} />
              </View>
              <View style={styles.offerContent}>
                <Text style={styles.offerTitle}>{r.name}</Text>
                <Text style={styles.offerDescription}>{ruleDescription(r)}</Text>
                <Text style={styles.offerMeta}>
                  {r.payment_filter !== 'any' ? `طريقة الدفع: ${r.payment_filter === 'cash' ? 'نقداً' : 'بطاقة'}  • ` : ''}
                  {r.min_subtotal ? `حد أدنى: ${r.min_subtotal} جنيه  • ` : ''}
                  {r.store_id && merchantsById[r.store_id] ? `المتجر: ${merchantsById[r.store_id].name_ar}` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  filterChip: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    ...typography.body,
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  offerCard: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.medium,
  },
  offerIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  offerContent: {
    flex: 1,
  },
  offerTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  offerDescription: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  offerMeta: {
    ...typography.small,
    color: colors.textLight,
  },
  offerCode: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  loadingBox: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
  },
  errorBox: {
    backgroundColor: colors.error + '10',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    margin: spacing.md,
  },
  errorText: {
    ...typography.body,
    color: colors.error,
  },
  emptyBox: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
  },
});
