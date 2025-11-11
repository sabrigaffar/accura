/**
 * شاشة المصادقة الرئيسية
 * يتم التوجيه تلقائياً إلى شاشة تسجيل الدخول الجديدة
 */

import { useEffect } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';

export default function AuthIndex() {
  const navState = useRootNavigationState();
  const { session } = useAuth();

  useEffect(() => {
    // لا تحاول التنقل قبل جهوزية الـ Root Layout
    if (!navState?.key) return;
    // إذا هناك جلسة بالفعل، اترك RoleNavigator يقرر التوجيه المناسب
    if (session) return;
    (async () => {
      try {
        const otpPending = await AsyncStorage.getItem('otp_pending_signup');
        if (otpPending !== 'true') {
          try { await AsyncStorage.setItem('kyc_merchant_from_signup', 'false'); } catch {}
        }
        const target = otpPending === 'true' ? '/auth/signup' : '/auth/login';
        router.replace(target as any);
      } catch {
        router.replace('/auth/login' as any);
      }
    })();
  }, [navState?.key, session]);

  return null;
}
