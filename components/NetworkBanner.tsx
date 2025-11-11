import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { colors, spacing, typography } from '@/constants/theme';

/**
 * NetworkBanner
 * يظهر شريطاً أعلى الشاشة عند انقطاع الاتصال بالإنترنت.
 * تنفيذ بدون أي تبعية خارجية: يفحص اتصال الإنترنت عبر طلب HTTP خفيف بشكل دوري.
 */
export default function NetworkBanner() {
  const [offline, setOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideAnim = useRef(new Animated.Value(0)).current; // 0 hidden, 1 visible

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      try {
        // طلب خفيف للتحقق من الوصول إلى الإنترنت
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('https://clients3.google.com/generate_204', {
          method: 'GET',
          signal: controller.signal,
        });
        clearTimeout(id);
        if (!mounted) return;
        // إذا كان الرد 204 أو 200 بدون تحويل، اعتبره متصلاً
        const ok = res && res.status >= 200 && res.status < 400;
        setOffline(!ok);
      } catch {
        if (!mounted) return;
        setOffline(true);
      }
    };

    // فحص أولي ثم تكرار كل 5 ثوانٍ
    check();
    timerRef.current = setInterval(check, 5000);

    return () => {
      mounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    // animate banner
    Animated.timing(slideAnim, {
      toValue: offline ? 1 : 0,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [offline, slideAnim]);

  // Keep node mounted to allow animation; when hidden, translate up
  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] });
  const opacity = slideAnim;

  return (
    <Animated.View pointerEvents={offline ? 'auto' : 'none'} style={[styles.banner, { transform: [{ translateY }], opacity }]}> 
      <Text style={styles.text}>⚠️ لا يوجد اتصال بالإنترنت. بعض الميزات قد لا تعمل.</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFB84D',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    zIndex: 1000,
  },
  text: {
    ...typography.caption,
    color: colors.black,
    textAlign: 'center',
    fontWeight: '600',
  },
});
