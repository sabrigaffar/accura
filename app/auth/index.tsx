/**
 * شاشة المصادقة الرئيسية
 * يتم التوجيه تلقائياً إلى شاشة تسجيل الدخول الجديدة
 */

import { useEffect } from 'react';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AuthIndex() {
  useEffect(() => {
    let timer: any;
    (async () => {
      try {
        const otpPending = await AsyncStorage.getItem('otp_pending_signup');
        // نظّف علم توثيق التاجر إن لم نكن في مسار تسجيل جديد
        if (otpPending !== 'true') {
          try { await AsyncStorage.setItem('kyc_merchant_from_signup', 'false'); } catch {}
        }
        const target = otpPending === 'true' ? '/auth/signup' : '/auth/login';
        timer = setTimeout(() => router.replace(target as any), 50);
      } catch {
        timer = setTimeout(() => router.replace('/auth/login' as any), 50);
      }
    })();
    return () => clearTimeout(timer);
  }, []);

  return null;
}
