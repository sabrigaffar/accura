import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';

interface SimpleMerchant {
  id: string;
  name_ar: string;
  logo_url?: string | null;
  category?: string | null;
  rating?: number | null;
  total_reviews?: number | null;
  is_open?: boolean | null;
  address?: string | null;
}

export default function CustomerHome() {
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<SimpleMerchant[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('merchants')
          .select('id, name_ar, logo_url, category, rating, total_reviews, is_open, address')
          .eq('is_active', true)
          .order('rating', { ascending: false })
          .limit(12);
        if (error) throw error;
        setMerchants(data || []);
      } catch (e) {
        console.warn('CustomerHome merchants load error', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>مرحباً بك 👋</Text>
        <Text style={styles.subtitle}>اكتشف أفضل المتاجر القريبة منك</Text>
      </View>

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={[styles.quickAction, styles.primaryBtn]} onPress={() => router.push('/(customer-tabs)/merchants' as any)}>
          <Text style={styles.quickActionText}>تصفح المتاجر</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickAction, styles.secondaryBtn]} onPress={() => router.push('/(customer-tabs)/orders' as any)}>
          <Text style={styles.quickActionText}>طلباتي</Text>
        </TouchableOpacity>
      </View>

      {/* Top merchants */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>أفضل المتاجر</Text>
          <TouchableOpacity onPress={() => router.push('/(customer-tabs)/merchants' as any)}>
            <Text style={styles.link}>مشاهدة الكل</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : merchants.length === 0 ? (
          <Text style={styles.emptyText}>لا توجد متاجر متاحة حالياً</Text>
        ) : (
          <View style={styles.grid}>
            {merchants.map((m) => (
              <TouchableOpacity key={m.id} style={styles.card} onPress={() => router.push({ pathname: '/merchant/[id]', params: { id: m.id } } as any)}>
                {m.logo_url ? (
                  <Image source={{ uri: m.logo_url }} style={styles.logo} />
                ) : (
                  <View style={[styles.logo, styles.logoPlaceholder]} />
                )}
                <Text style={styles.merchantName} numberOfLines={1}>{m.name_ar}</Text>
                <Text style={styles.merchantMeta} numberOfLines={1}>
                  {(m.category || 'عام')} • {(m.is_open ? 'مفتوح' : 'مغلق')}
                </Text>
                {typeof m.rating === 'number' && (
                  <Text style={styles.rating}>{m.rating?.toFixed(1)} ★ ({m.total_reviews || 0})</Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { padding: spacing.lg },
  header: { marginBottom: spacing.lg },
  title: { ...typography.h2, color: colors.text },
  subtitle: { ...typography.body, color: colors.textLight, marginTop: spacing.xs },
  quickActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  quickAction: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.full },
  primaryBtn: { backgroundColor: colors.primary },
  secondaryBtn: { backgroundColor: colors.warning },
  quickActionText: { ...typography.bodyMedium, color: colors.white, fontWeight: '600' },
  section: { marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { ...typography.h3, color: colors.text },
  link: { ...typography.bodyMedium, color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48%', backgroundColor: colors.white, borderRadius: borderRadius.lg, padding: spacing.md, marginBottom: spacing.md },
  logo: { width: '100%', height: 80, borderRadius: borderRadius.md, marginBottom: spacing.sm, backgroundColor: colors.lightGray },
  logoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  merchantName: { ...typography.bodyMedium, color: colors.text },
  merchantMeta: { ...typography.caption, color: colors.textLight, marginTop: 2 },
  rating: { ...typography.caption, color: colors.success, marginTop: spacing.xs },
  emptyText: { ...typography.body, color: colors.textLight },
});
