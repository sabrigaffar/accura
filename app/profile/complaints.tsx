import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';

interface Complaint {
  id: string;
  title: string;
  status: 'open' | 'in_review' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  target_type: 'order' | 'merchant' | 'driver' | 'other' | null;
  target_id: string | null;
  created_at: string;
}

export default function ComplaintsScreen() {
  const [items, setItems] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const styles = useStyles();

  const fetchComplaints = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('complaints')
        .select('id, title, status, priority, target_type, target_id, created_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setItems((data as any) || []);
    } catch (e) {
      console.error('fetch complaints error', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, []);
  useFocusEffect(useCallback(() => { fetchComplaints(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchComplaints();
    setRefreshing(false);
  };

  const statusColor = (st: Complaint['status']) => {
    switch (st) {
      case 'open': return colors.warning;
      case 'in_review': return colors.primary;
      case 'resolved': return colors.success;
      case 'closed': return colors.textLight;
      default: return colors.textLight;
    }
  };

  const goToTarget = (c: Complaint) => {
    if (c.target_type === 'order' && c.target_id) {
      router.push(`/order/${c.target_id}` as any);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}> 
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الشكاوى</Text>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.center}> 
            <Text style={styles.muted}>جاري التحميل...</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>لا توجد شكاوى حتى الآن</Text>
          </View>
        ) : (
          <View style={{ padding: spacing.md }}>
            {items.map((c) => (
              <TouchableOpacity key={c.id} style={styles.card} onPress={() => goToTarget(c)}>
                <View style={styles.rowBetween}>
                  <Text style={styles.title} numberOfLines={1}>{c.title}</Text>
                  <Text style={[styles.badge, { color: statusColor(c.status) }]}>
                    {c.status === 'open' ? 'مفتوحة' : c.status === 'in_review' ? 'قيد المراجعة' : c.status === 'resolved' ? 'تم الحل' : 'مغلقة'}
                  </Text>
                </View>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>الأولوية: {c.priority === 'high' ? 'عالية' : c.priority === 'low' ? 'منخفضة' : 'متوسطة'}</Text>
                  {c.target_type && (
                    <Text style={styles.meta}>
                      {c.target_type === 'order' ? 'طلب' : c.target_type === 'merchant' ? 'متجر' : c.target_type === 'driver' ? 'سائق' : 'أخرى'}
                    </Text>
                  )}
                </View>
                <Text style={styles.date}>{new Date(c.created_at).toLocaleString()}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { backgroundColor: colors.white, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text, textAlign: 'center' },
  content: { flex: 1 },
  center: { padding: spacing.xxl, alignItems: 'center' },
  muted: { ...typography.body, color: colors.textLight },
  card: { backgroundColor: colors.white, borderRadius: borderRadius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...typography.bodyMedium, color: colors.text, flex: 1, marginRight: spacing.sm },
  badge: { ...typography.caption },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  meta: { ...typography.caption, color: colors.textLight },
  date: { ...typography.caption, color: colors.textLight, marginTop: spacing.xs },
});
