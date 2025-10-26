import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrendingUp } from 'lucide-react-native';
import { colors, spacing, typography } from '@/constants/theme';

export default function MerchantAnalytics() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الإحصائيات</Text>
      </View>
      <View style={styles.content}>
        <TrendingUp size={64} color={colors.textLight} />
        <Text style={styles.emptyText}>إحصائياتك ستظهر هنا</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: spacing.lg, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerTitle: { ...typography.h2, color: colors.text },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { ...typography.body, color: colors.textLight, marginTop: spacing.md },
});
