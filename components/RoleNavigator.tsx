import { useEffect, useRef } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from './LoadingScreen';

export function RoleNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { session, userType, loading } = useAuth();
  const lastUserType = useRef<string | null>(null);

  // ✅ إعادة تعيين العلم عند تغيير userType
  useEffect(() => {
    if (userType !== lastUserType.current) {
      lastUserType.current = userType;
    }
  }, [userType]);

  // ✅ توجيه حسب نوع المستخدم عند تغيّر الجلسة أو نوع المستخدم
  useEffect(() => {
    if (loading) return;
    const currentRoot = segments[0] || '';

    if (!session) {
      if (currentRoot !== 'auth') {
        router.replace('/auth');
      }
      return;
    }

    // انتظر حتى يتم جلب نوع المستخدم لتجنب التوجيه الافتراضي لواجهة العميل
    if (!userType) return;

    const targetRoot = userType === 'merchant'
      ? '(merchant-tabs)'
      : userType === 'driver'
        ? '(driver-tabs)'
        : '(customer-tabs)';

    const safeRoots = new Set(['', '(customer-tabs)', '(driver-tabs)', '(merchant-tabs)', '(tabs)', 'auth']);
    if (!safeRoots.has(currentRoot)) {
      return;
    }

    // وجّه فقط إذا كنا على جذر خاطئ
    if (currentRoot !== targetRoot) {
      router.replace(`/${targetRoot}`);
    }
  }, [loading, session, userType]);

  // ✅ الاستماع لتسجيل الخروج فقط
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace('/auth');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ✅ عرض شاشة تحميل بعد كل الـ Hooks
  if (loading) {
    return <LoadingScreen message="جاري تحميل بياناتك..." />;
  }

  return <>{children}</>;
}
