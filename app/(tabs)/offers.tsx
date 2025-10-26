import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Tag, Percent } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';

export default function OffersScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>العروض والخصومات</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.offerCard}>
          <View style={styles.offerIcon}>
            <Percent size={32} color={colors.white} />
          </View>
          <View style={styles.offerContent}>
            <Text style={styles.offerTitle}>خصم 50% على أول طلب</Text>
            <Text style={styles.offerDescription}>
              استمتع بخصم 50% على طلبك الأول من أي مطعم
            </Text>
            <Text style={styles.offerCode}>كود: FIRST50</Text>
          </View>
        </View>

        <View style={styles.offerCard}>
          <View style={[styles.offerIcon, { backgroundColor: colors.secondary }]}>
            <Tag size={32} color={colors.text} />
          </View>
          <View style={styles.offerContent}>
            <Text style={styles.offerTitle}>توصيل مجاني</Text>
            <Text style={styles.offerDescription}>
              احصل على توصيل مجاني للطلبات فوق 100 ريال
            </Text>
            <Text style={styles.offerCode}>كود: FREEDEL</Text>
          </View>
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
  offerCode: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
});
