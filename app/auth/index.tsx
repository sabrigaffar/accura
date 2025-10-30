/**
 * شاشة المصادقة الرئيسية
 * يتم التوجيه تلقائياً إلى شاشة تسجيل الدخول الجديدة
 */

import { useEffect } from 'react';
import { router } from 'expo-router';

export default function AuthIndex() {
  useEffect(() => {
    // التوجيه الفوري إلى شاشة تسجيل الدخول الجديدة (Email/Phone + Password)
    const timer = setTimeout(() => {
      router.replace('/auth/login' as any);
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return null;
}
