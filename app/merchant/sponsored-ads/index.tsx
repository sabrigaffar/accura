import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Plus, TrendingUp, Eye, MousePointer, DollarSign, Play, Pause, Trash2 } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { StoreButton } from '@/components/StoreSelector';

interface Ad {
  id: string;
  ad_type: 'banner' | 'story' | 'featured';
  title: string;
  description: string;
  image_url: string;
  is_active: boolean;
  approval_status: 'pending' | 'approved' | 'rejected';
  rejection_reason?: string;
  start_date: string;
  end_date: string;
  budget_amount: number;
  total_spent: number;
  impression_count: number;
  click_count: number;
  conversion_count: number;
  ctr: number;
  // offer fields
  discount_type?: 'percent' | 'flat';
  discount_amount?: number;
  apply_on?: 'subtotal' | 'delivery_fee' | 'service_fee' | 'product';
  target_product_id?: string | null;
  offer_label?: string | null;
}

export default function SponsoredAdsScreen() {
  const { user } = useAuth();
  const { activeStore, isAllStoresSelected, stores } = useActiveStore();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalImpressions: 0,
    totalClicks: 0,
    totalConversions: 0,
    totalSpent: 0,
    avgCTR: 0,
  });
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [allLoading, setAllLoading] = useState(false);

  useEffect(() => {
    if (activeStore && !isAllStoresSelected) {
      fetchAds();
      fetchStats();
    }
  }, [activeStore]);

  // Realtime updates: reflect delete/updates immediately
  useEffect(() => {
    if (!activeStore || isAllStoresSelected) return;
    const channel = supabase
      .channel(`sponsored_ads_${activeStore.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sponsored_ads', filter: `merchant_id=eq.${activeStore.id}` }, (payload: any) => {
        const row: any = payload.new || payload.old;
        if (!row) return;
        if (payload.eventType === 'DELETE' || (payload.eventType === 'UPDATE' && row.deleted_at)) {
          setAds(prev => prev.filter(a => a.id === row.id ? false : true));
        } else if (payload.eventType === 'UPDATE') {
          setAds(prev => prev.map(a => a.id === row.id ? {
            ...a,
            is_active: row.is_active,
            approval_status: row.approval_status,
            total_spent: row.total_spent,
            impression_count: row.impression_count,
            click_count: row.click_count,
            ctr: row.impression_count > 0 ? (row.click_count / row.impression_count) * 100 : 0,
          } : a));
        } else if (payload.eventType === 'INSERT') {
          // Only include if not deleted
          if (!row.deleted_at && row.merchant_id === activeStore.id) {
            setAds(prev => [{
              ...row,
              ctr: row.impression_count > 0 ? (row.click_count / row.impression_count) * 100 : 0,
            }, ...prev]);
          }
        }
      })
      .subscribe();
    return () => { try { supabase.removeChannel(channel); } catch {} };
  }, [activeStore?.id, isAllStoresSelected]);

  useEffect(() => {
    if (isAllStoresSelected) {
      fetchAllAds();
    }
  }, [isAllStoresSelected, stores]);

  const fetchAds = async () => {
    if (!activeStore) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('sponsored_ads')
        .select('*')
        .eq('merchant_id', activeStore.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate CTR for each ad
      const adsWithCTR = (data || []).map(ad => ({
        ...ad,
        ctr: ad.impression_count > 0 
          ? (ad.click_count / ad.impression_count) * 100 
          : 0,
      }));

      setAds(adsWithCTR);
    } catch (error: any) {
      console.error('Error fetching ads:', error);
      Alert.alert('خطأ', 'فشل تحميل الإعلانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllAds = async () => {
    try {
      setAllLoading(true);
      const storeIds = (stores || []).map(s => s.id);
      if (storeIds.length === 0) {
        setAllAds([]);
        setAllLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('sponsored_ads')
        .select('*')
        .in('merchant_id', storeIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate CTR for each ad
      const adsWithCTR = (data || []).map(ad => ({
        ...ad,
        ctr: ad.impression_count > 0 
          ? (ad.click_count / ad.impression_count) * 100 
          : 0,
      }));

      setAllAds(adsWithCTR);
    } catch (error: any) {
      console.error('Error fetching all ads:', error);
      Alert.alert('خطأ', 'فشل تحميل إعلانات جميع المتاجر');
    } finally {
      setAllLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!activeStore) return;

    try {
      const { data, error } = await supabase.rpc('get_ad_analytics', {
        p_merchant_id: activeStore.id,
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const totals = data.reduce((acc: any, curr: any) => ({
          totalImpressions: acc.totalImpressions + (curr.impressions || 0),
          totalClicks: acc.totalClicks + (curr.clicks || 0),
          totalConversions: acc.totalConversions + (curr.conversions || 0),
          totalSpent: acc.totalSpent + (curr.total_spent || 0),
        }), { totalImpressions: 0, totalClicks: 0, totalConversions: 0, totalSpent: 0 });

        setStats({
          ...totals,
          avgCTR: totals.totalImpressions > 0 
            ? (totals.totalClicks / totals.totalImpressions) * 100 
            : 0,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const toggleAdStatus = async (adId: string, currentStatus: boolean, approvalStatus: string) => {
    // Prevent toggling if ad is pending approval
    if (approvalStatus === 'pending') {
      Alert.alert('⚠️ غير مسموح', 'لا يمكن تفعيل الإعلان حتى تتم موافقة الإدارة');
      return;
    }

    // Prevent toggling if ad is rejected
    if (approvalStatus === 'rejected') {
      Alert.alert('⚠️ غير مسموح', 'هذا الإعلان مرفوض');
      return;
    }

    try {
      const { error } = await supabase
        .from('sponsored_ads')
        .update({ is_active: !currentStatus })
        .eq('id', adId);

      if (error) throw error;

      Alert.alert('✅ تم', `تم ${!currentStatus ? 'تفعيل' : 'إيقاف'} الإعلان`);
      fetchAds();
    } catch (error: any) {
      Alert.alert('خطأ', 'فشل تحديث حالة الإعلان');
    }
  };

  const deleteAd = async (adId: string) => {
    Alert.alert(
      'حذف الإعلان',
      'هل أنت متأكد من حذف هذا الإعلان؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              const { data, error } = await supabase.rpc('merchant_delete_sponsored_ad', { p_ad_id: adId });
              if (error) throw error;
              // The RPC returns a json object with success flag
              if (!data || data.success !== true) {
                const msg = (data && (data.error || data.message)) || 'فشل حذف الإعلان بسبب عدم تسوية المستحقات. الرجاء شحن المحفظة ثم المحاولة.';
                Alert.alert('⚠️ تعذر الحذف', String(msg));
                return;
              }
              // Optimistically remove from UI
              setAds(prev => prev.filter(a => a.id !== adId));
              Alert.alert('✅ تم', 'تم حذف الإعلان وتسوية/استرجاع الرصيد تلقائياً');
              // Refresh list and aggregates
              if (isAllStoresSelected) {
                await fetchAllAds();
              } else {
                await fetchAds();
              }
              await fetchStats();
            } catch (error) {
              Alert.alert('خطأ', 'فشل حذف الإعلان');
            }
          },
        },
      ]
    );
  };

  const getAdTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      banner: 'بانر',
      story: 'قصة',
      featured: 'مميز',
    };
    return labels[type] || type;
  };

  const getAdTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      banner: '#FF6B6B',
      story: '#4ECDC4',
      featured: '#FFD700',
    };
    return colors[type] || '#95A5A6';
  };

  if (isAllStoresSelected || !activeStore) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => ((router as any).canGoBack?.() ? router.back() : router.push('/(merchant-tabs)' as any))} style={styles.backButton}>
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>الإعلانات المموّلة</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>الرجاء اختيار متجر محدد</Text>
          <Text style={styles.emptySubtext}>الإعلانات تُدار لكل متجر على حدة</Text>
          <View style={styles.storeSelectorWrapper}>
            <StoreButton />
          </View>
        </View>

        {/* All stores ads section */}
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Text style={styles.emptyText}>إعلانات جميع المتاجر</Text>
        </View>
        {allLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : allAds.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptySubtext}>لا توجد إعلانات لأي متجر</Text>
          </View>
        ) : (
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {allAds.map(ad => (
              <View key={ad.id} style={styles.adCard}>
                <View style={styles.adHeader}>
                  <View style={styles.adTypeContainer}>
                    <View style={[styles.adTypeBadge, { backgroundColor: getAdTypeColor(ad.ad_type) }]}>
                      <Text style={styles.adTypeText}>{getAdTypeLabel(ad.ad_type)}</Text>
                    </View>
                    {ad.approval_status === 'pending' && (
                      <View style={[styles.activeBadge, { backgroundColor: '#FFA500' + '30' }]}>
                        <Text style={[styles.activeText, { color: '#FFA500' }]}>⏳ ينتظر الموافقة</Text>
                      </View>
                    )}
                    {ad.approval_status === 'approved' && ad.is_active && (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeText}>✅ نشط</Text>
                      </View>
                    )}
                    {ad.approval_status === 'rejected' && (
                      <View style={[styles.activeBadge, { backgroundColor: colors.error + '20' }]}>
                        <Text style={[styles.activeText, { color: colors.error }]}>❌ مرفوض</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.adActions}>
                    {ad.approval_status === 'approved' && (
                      <TouchableOpacity
                        onPress={() => toggleAdStatus(ad.id, ad.is_active, ad.approval_status)}
                        style={styles.actionButton}
                      >
                        {ad.is_active ? (
                          <Pause size={18} color={colors.text} />
                        ) : (
                          <Play size={18} color={colors.text} />
                        )}
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => deleteAd(ad.id)}
                      style={styles.actionButton}
                    >
                      <Trash2 size={18} color={colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={styles.adTitle}>{ad.title}</Text>
                {ad.description && (
                  <Text style={styles.adDescription} numberOfLines={2}>
                    {ad.description}
                  </Text>
                )}

                <View style={styles.adStats}>
                  <View style={styles.adStatItem}>
                    <Eye size={14} color={colors.textLight} />
                    <Text style={styles.adStatText}>{ad.impression_count}</Text>
                  </View>
                  <View style={styles.adStatItem}>
                    <MousePointer size={14} color={colors.textLight} />
                    <Text style={styles.adStatText}>{ad.click_count}</Text>
                  </View>
                  <View style={styles.adStatItem}>
                    <TrendingUp size={14} color={colors.textLight} />
                    <Text style={styles.adStatText}>{Number(ad.ctr || 0).toFixed(2)}%</Text>
                  </View>
                </View>

                <View style={styles.budgetBar}>
                  <View style={styles.budgetInfo}>
                    <Text style={styles.budgetLabel}>الميزانية</Text>
                    <Text style={styles.budgetText}>
                      {Number(ad.total_spent || 0).toFixed(0)} / {Number(ad.budget_amount || 0).toFixed(0)} ج
                    </Text>
                  </View>
                  <View style={styles.progressBar}>
                    <View 
                      style={[
                        styles.progressFill, 
                        { 
                          width: `${Math.min(((Number(ad.budget_amount || 0) > 0) ? (Number(ad.total_spent || 0) / Number(ad.budget_amount || 0)) * 100 : 0), 100)}%`,
                          backgroundColor: (Number(ad.total_spent || 0) >= Number(ad.budget_amount || 0) && Number(ad.budget_amount || 0) > 0) ? colors.error : colors.primary,
                        }
                      ]} 
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={styles.viewAnalyticsButton}
                  onPress={() => router.push(`/merchant/sponsored-ads/${ad.id}/analytics` as any)}
                >
                  <Text style={styles.viewAnalyticsText}>عرض التفاصيل →</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.push('/(merchant-tabs)' as any)} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الإعلانات المموّلة</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => router.push('/merchant/sponsored-ads/create' as any)}
        >
          <Plus size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#4ECDC4' + '20' }]}>
            <Eye size={24} color="#4ECDC4" />
            <Text style={styles.statValue}>{stats.totalImpressions.toLocaleString()}</Text>
            <Text style={styles.statLabel}>مشاهدات</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#FF6B6B' + '20' }]}>
            <MousePointer size={24} color="#FF6B6B" />
            <Text style={styles.statValue}>{stats.totalClicks.toLocaleString()}</Text>
            <Text style={styles.statLabel}>نقرات</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#45B7D1' + '20' }]}>
            <TrendingUp size={24} color="#45B7D1" />
            <Text style={styles.statValue}>{Number(stats.avgCTR || 0).toFixed(2)}%</Text>
            <Text style={styles.statLabel}>CTR</Text>
          </View>

          <View style={[styles.statCard, { backgroundColor: '#FFD700' + '20' }]}>
            <DollarSign size={24} color="#FFD700" />
            <Text style={styles.statValue}>{Number(stats.totalSpent || 0).toFixed(0)} ج</Text>
            <Text style={styles.statLabel}>الإنفاق</Text>
          </View>
        </View>

        {/* Ads List */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : ads.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>لا توجد إعلانات</Text>
            <Text style={styles.emptySubtext}>انشئ أول إعلان مموّل لمتجرك</Text>
            <TouchableOpacity 
              style={styles.createFirstButton}
              onPress={() => router.push('/merchant/sponsored-ads/create' as any)}
            >
              <Plus size={20} color={colors.white} />
              <Text style={styles.createFirstButtonText}>إنشاء إعلان</Text>
            </TouchableOpacity>
          </View>
        ) : (
          ads.map(ad => (
            <View key={ad.id} style={styles.adCard}>
              <View style={styles.adHeader}>
                <View style={styles.adTypeContainer}>
                  <View style={[styles.adTypeBadge, { backgroundColor: getAdTypeColor(ad.ad_type) }]}>
                    <Text style={styles.adTypeText}>{getAdTypeLabel(ad.ad_type)}</Text>
                  </View>
                  {ad.approval_status === 'pending' && (
                    <View style={[styles.activeBadge, { backgroundColor: '#FFA500' + '30' }]}>
                      <Text style={[styles.activeText, { color: '#FFA500' }]}>⏳ ينتظر الموافقة</Text>
                    </View>
                  )}
                  {ad.approval_status === 'approved' && ad.is_active && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeText}>✅ نشط</Text>
                    </View>
                  )}
                  {ad.approval_status === 'rejected' && (
                    <View style={[styles.activeBadge, { backgroundColor: colors.error + '20' }]}>
                      <Text style={[styles.activeText, { color: colors.error }]}>❌ مرفوض</Text>
                    </View>
                  )}
                </View>
                <View style={styles.adActions}>
                  {ad.approval_status === 'approved' && (
                    <TouchableOpacity
                      onPress={() => toggleAdStatus(ad.id, ad.is_active, ad.approval_status)}
                      style={styles.actionButton}
                    >
                      {ad.is_active ? (
                        <Pause size={18} color={colors.text} />
                      ) : (
                        <Play size={18} color={colors.text} />
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => deleteAd(ad.id)}
                    style={styles.actionButton}
                  >
                    <Trash2 size={18} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>

              <Text style={styles.adTitle}>{ad.title}</Text>
              {ad.description && (
                <Text style={styles.adDescription} numberOfLines={2}>
                  {ad.description}
                </Text>
              )}

              {/* Offer summary */}
              {ad.offer_label && (
                <Text style={styles.adDescription}>
                  العرض: {ad.offer_label}
                  {ad.apply_on === 'delivery_fee' ? ' على التوصيل' : ad.apply_on === 'service_fee' ? ' على رسوم الخدمة' : ad.apply_on === 'product' ? ' على منتج محدد' : ' على إجمالي السلة'}
                </Text>
              )}

              <View style={styles.adStats}>
                <View style={styles.adStatItem}>
                  <Eye size={14} color={colors.textLight} />
                  <Text style={styles.adStatText}>{ad.impression_count}</Text>
                </View>
                <View style={styles.adStatItem}>
                  <MousePointer size={14} color={colors.textLight} />
                  <Text style={styles.adStatText}>{ad.click_count}</Text>
                </View>
                <View style={styles.adStatItem}>
                  <TrendingUp size={14} color={colors.textLight} />
                  <Text style={styles.adStatText}>{Number(ad.ctr || 0).toFixed(2)}%</Text>
                </View>
              </View>

              <View style={styles.budgetBar}>
                <View style={styles.budgetInfo}>
                  <Text style={styles.budgetLabel}>الميزانية</Text>
                  <Text style={styles.budgetText}>
                    {Number(ad.total_spent || 0).toFixed(0)} / {Number(ad.budget_amount || 0).toFixed(0)} ج
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${Math.min(((Number(ad.budget_amount || 0) > 0) ? (Number(ad.total_spent || 0) / Number(ad.budget_amount || 0)) * 100 : 0), 100)}%`,
                        backgroundColor: (Number(ad.total_spent || 0) >= Number(ad.budget_amount || 0) && Number(ad.budget_amount || 0) > 0) ? colors.error : colors.primary,
                      }
                    ]} 
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.viewAnalyticsButton}
                onPress={() => router.push(`/merchant/sponsored-ads/${ad.id}/analytics` as any)}
              >
                <Text style={styles.viewAnalyticsText}>عرض التفاصيل →</Text>
              </TouchableOpacity>
            </View>
          ))
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
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  statCard: {
    width: '48%',
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statValue: {
    ...typography.h2,
    color: colors.text,
    fontWeight: '700',
  },
  statLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  storeSelectorWrapper: {
    width: '100%',
    paddingHorizontal: spacing.lg,
  },
  createFirstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  createFirstButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  adCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  adHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  adTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  adTypeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  activeBadge: {
    backgroundColor: colors.success + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  activeText: {
    ...typography.caption,
    color: colors.success,
    fontWeight: '600',
  },
  adActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    padding: spacing.xs,
  },
  adTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  adDescription: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  adStats: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  adStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  adStatText: {
    ...typography.caption,
    color: colors.textLight,
  },
  budgetBar: {
    marginBottom: spacing.md,
  },
  budgetInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  budgetLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  budgetText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  viewAnalyticsButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  viewAnalyticsText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
});
