import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, ActivityIndicator, Image } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = 'جاري التحميل...' }: LoadingScreenProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo or App Icon */}
        <View style={styles.logoContainer}>
          <View style={styles.logo}>
            <Image
              source={require('../assets/images/logo-accura.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Loading Indicator */}
        <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />

        {/* Message */}
        <Text style={styles.message}>{message}</Text>
        
        {/* App Name */}
        <Text style={styles.appName}>Accura</Text>
        <Text style={styles.tagline}>نظام التوصيل الذكي</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  logoContainer: {
    marginBottom: spacing.xl,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    width: 80,
    height: 80,
  },
  spinner: {
    marginVertical: spacing.lg,
  },
  message: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  appName: {
    ...typography.h1,
    color: colors.primary,
    marginTop: spacing.xl,
  },
  tagline: {
    ...typography.caption,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});
