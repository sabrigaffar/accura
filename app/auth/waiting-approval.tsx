import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function WaitingApprovalScreen() {
  const { signOut } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>طلبك قيد المراجعة</Text>
        <Text style={styles.body}>
          شكرًا لتسجيلك. سيتم مراجعة مستنداتك من قبل الإدارة خلال وقت قصير.
          سنقوم بإشعارك فور تغيير حالة الحساب.
        </Text>
        <TouchableOpacity
          style={styles.button}
          onPress={async () => {
            // خيار: خروج والعودة لاحقًا
            await signOut();
            router.replace('/auth/login' as any);
          }}
        >
          <Text style={styles.buttonText}>تسجيل الخروج</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    width: '100%',
  },
  title: {
    ...typography.h1,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  body: {
    ...(typography.body as any),
    color: colors.textLight,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});
