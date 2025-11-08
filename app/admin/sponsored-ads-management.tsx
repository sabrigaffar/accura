import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Check, X, Eye, Settings, TrendingUp } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface PendingAd {
  id: string;
  merchant_id: string;
  merchant_name: string;
  ad_type: string;
  title: string;
  description: string;
  image_url: string;
  budget_amount: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

interface AdSettings {
  cost_per_click: number;
  cost_per_impression: number;
  min_budget: number;
  max_budget: number;
  min_duration_days: number;
  max_duration_days: number;
}

export default function AdminAdsManagementScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'pending' | 'settings'>('pending');
  const [pendingAds, setPendingAds] = useState<PendingAd[]>([]);
  const [settings, setSettings] = useState<AdSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    fetchPendingAds();
    fetchSettings();
  }, []);

  const fetchPendingAds = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_pending_ads_for_review');

      if (error) throw error;
      setPendingAds(data || []);
    } catch (error) {
      console.error('Error fetching pending ads:', error);
      Alert.alert('خطأ', 'فشل تحميل الإعلانات المعلقة');
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_ad_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const approveAd = async (adId: string, merchantName: string) => {
    Alert.alert(
      'الموافقة على الإعلان',
      `هل تريد الموافقة على إعلان ${merchantName}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'موافقة',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc('approve_ad', {
                p_ad_id: adId,
                p_admin_id: user?.id,
              });

              if (error) throw error;

              Alert.alert('✅ تم', 'تمت الموافقة على الإعلان وتفعيله');
              fetchPendingAds();
            } catch (error: any) {
              Alert.alert('خطأ', error.message || 'فشل الموافقة على الإعلان');
            }
          },
        },
      ]
    );
  };

  const rejectAd = async (adId: string, merchantName: string) => {
    Alert.prompt(
      'رفض الإعلان',
      `أدخل سبب رفض إعلان ${merchantName}:`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'رفض',
          style: 'destructive',
          onPress: async (reason?: string) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('خطأ', 'الرجاء إدخال سبب الرفض');
              return;
            }

            try {
              const { error } = await supabase.rpc('reject_ad', {
                p_ad_id: adId,
                p_admin_id: user?.id,
                p_reason: reason.trim(),
              });

              if (error) throw error;

              Alert.alert('✅ تم', 'تم رفض الإعلان واسترجاع المبلغ للتاجر');
              fetchPendingAds();
            } catch (error: any) {
              Alert.alert('خطأ', error.message || 'فشل رفض الإعلان');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const saveSettings = async () => {
    if (!settings) return;

    try {
      setSavingSettings(true);

      const { error } = await supabase
        .from('platform_ad_settings')
        .update({
          cost_per_click: settings.cost_per_click,
          cost_per_impression: settings.cost_per_impression,
          min_budget: settings.min_budget,
          max_budget: settings.max_budget,
          min_duration_days: settings.min_duration_days,
          max_duration_days: settings.max_duration_days,
          updated_at: new Date().toISOString(),
          updated_by: user?.id,
        })
        .eq('id', '00000000-0000-0000-0000-000000000001');

      if (error) throw error;

      Alert.alert('✅ تم', 'تم حفظ الإعدادات بنجاح');
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل حفظ الإعدادات');
    } finally {
      setSavingSettings(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
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

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إدارة الإعلانات المموّلة</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Eye size={20} color={activeTab === 'pending' ? colors.primary : colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            المعلقة ({pendingAds.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
          onPress={() => setActiveTab('settings')}
        >
          <Settings size={20} color={activeTab === 'settings' ? colors.primary : colors.textLight} />
          <Text style={[styles.tabText, activeTab === 'settings' && styles.tabTextActive]}>
            الإعدادات
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'pending' ? (
          // Pending Ads Tab
          loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : pendingAds.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>لا توجد إعلانات معلقة</Text>
              <Text style={styles.emptySubtext}>جميع الإعلانات تمت مراجعتها</Text>
            </View>
          ) : (
            pendingAds.map((ad) => (
              <View key={ad.id} style={styles.adCard}>
                <View style={styles.adImageContainer}>
                  <Image source={{ uri: ad.image_url }} style={styles.adImage} />
                  <View style={[styles.adTypeBadge, { backgroundColor: getAdTypeColor(ad.ad_type) }]}>
                    <Text style={styles.adTypeText}>{getAdTypeLabel(ad.ad_type)}</Text>
                  </View>
                </View>

                <View style={styles.adInfo}>
                  <Text style={styles.merchantName}>{ad.merchant_name}</Text>
                  <Text style={styles.adTitle}>{ad.title}</Text>
                  {ad.description && (
                    <Text style={styles.adDescription} numberOfLines={2}>
                      {ad.description}
                    </Text>
                  )}

                  <View style={styles.adMetaRow}>
                    <View style={styles.adMetaItem}>
                      <Text style={styles.adMetaLabel}>الميزانية:</Text>
                      <Text style={styles.adMetaValue}>{ad.budget_amount.toFixed(0)} ج</Text>
                    </View>
                    <View style={styles.adMetaItem}>
                      <Text style={styles.adMetaLabel}>المدة:</Text>
                      <Text style={styles.adMetaValue}>
                        {formatDate(ad.start_date)} - {formatDate(ad.end_date)}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.createdAt}>
                    تم الإنشاء: {formatDate(ad.created_at)}
                  </Text>
                </View>

                <View style={styles.adActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => approveAd(ad.id, ad.merchant_name)}
                  >
                    <Check size={20} color={colors.white} />
                    <Text style={styles.actionButtonText}>موافقة</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => rejectAd(ad.id, ad.merchant_name)}
                  >
                    <X size={20} color={colors.white} />
                    <Text style={styles.actionButtonText}>رفض</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )
        ) : (
          // Settings Tab
          settings && (
            <View style={styles.settingsContainer}>
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>💰 الأسعار</Text>

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>سعر النقرة (ج)</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={String(settings.cost_per_click)}
                    onChangeText={(text) =>
                      setSettings({ ...settings, cost_per_click: parseFloat(text) || 0 })
                    }
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>سعر المشاهدة (ج)</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={String(settings.cost_per_impression)}
                    onChangeText={(text) =>
                      setSettings({ ...settings, cost_per_impression: parseFloat(text) || 0 })
                    }
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>📊 حدود الميزانية</Text>

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>الحد الأدنى (ج)</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={String(settings.min_budget)}
                    onChangeText={(text) =>
                      setSettings({ ...settings, min_budget: parseFloat(text) || 0 })
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>الحد الأقصى (ج)</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={String(settings.max_budget)}
                    onChangeText={(text) =>
                      setSettings({ ...settings, max_budget: parseFloat(text) || 0 })
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>📅 حدود المدة</Text>

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>الحد الأدنى (أيام)</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={String(settings.min_duration_days)}
                    onChangeText={(text) =>
                      setSettings({ ...settings, min_duration_days: parseInt(text) || 0 })
                    }
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.settingItem}>
                  <Text style={styles.settingLabel}>الحد الأقصى (أيام)</Text>
                  <TextInput
                    style={styles.settingInput}
                    value={String(settings.max_duration_days)}
                    onChangeText={(text) =>
                      setSettings({ ...settings, max_duration_days: parseInt(text) || 0 })
                    }
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, savingSettings && styles.saveButtonDisabled]}
                onPress={saveSettings}
                disabled={savingSettings}
              >
                {savingSettings ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Check size={20} color={colors.white} />
                    <Text style={styles.saveButtonText}>حفظ الإعدادات</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.previewCard}>
                <Text style={styles.previewTitle}>💡 معاينة التكلفة</Text>
                <Text style={styles.previewText}>
                  مثال: إعلان بميزانية 1000 ج يحصل على:
                </Text>
                <Text style={styles.previewValue}>
                  • {Math.floor(1000 / settings.cost_per_click)} نقرة (عند 100% نقرات)
                </Text>
                <Text style={styles.previewValue}>
                  • {Math.floor(1000 / settings.cost_per_impression)} مشاهدة (عند 100% مشاهدات)
                </Text>
              </View>
            </View>
          )
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
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.body,
    color: colors.textLight,
  },
  tabTextActive: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
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
  },
  emptySubtext: {
    ...typography.body,
    color: colors.textLight,
  },
  adCard: {
    backgroundColor: colors.white,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  adImageContainer: {
    position: 'relative',
  },
  adImage: {
    width: '100%',
    height: 200,
  },
  adTypeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  adTypeText: {
    ...typography.caption,
    color: colors.white,
    fontWeight: '600',
  },
  adInfo: {
    padding: spacing.lg,
  },
  merchantName: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  adTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  adDescription: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
  },
  adMetaRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginBottom: spacing.sm,
  },
  adMetaItem: {
    flex: 1,
  },
  adMetaLabel: {
    ...typography.caption,
    color: colors.textLight,
    marginBottom: 2,
  },
  adMetaValue: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  createdAt: {
    ...typography.caption,
    color: colors.textLight,
  },
  adActions: {
    flexDirection: 'row',
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  approveButton: {
    backgroundColor: colors.success,
  },
  rejectButton: {
    backgroundColor: colors.error,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  settingsContainer: {
    padding: spacing.lg,
  },
  settingsSection: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  settingsSectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  settingLabel: {
    ...typography.body,
    color: colors.text,
    flex: 1,
  },
  settingInput: {
    ...typography.bodyMedium,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    width: 100,
    textAlign: 'center',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    ...typography.h3,
    color: colors.white,
    fontWeight: '700',
  },
  previewCard: {
    backgroundColor: colors.secondary + '10',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
  },
  previewTitle: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  previewText: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.sm,
  },
  previewValue: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
});
