import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from './LoadingScreen';

export function RoleNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const navState = useRootNavigationState();
  const { session, userType, loading, approvalPending, approvalChecked } = useAuth();
  const lastUserType = useRef<string | null>(null);
  const bootRedirectDone = useRef(false);
  const noSessionTimer = useRef<any>(null);
  const signedOutRef = useRef(false);

  // ✅ إعادة تعيين العلم عند تغيير userType
  useEffect(() => {
    if (userType !== lastUserType.current) {
      lastUserType.current = userType;
    }
  }, [userType]);

  // ✅ توجيه حسب نوع المستخدم عند تغيّر الجلسة أو نوع المستخدم
  useEffect(() => {
    if (loading) return;
    // لا تحاول أي توجيه قبل جاهزية نظام الملاحة الجذرية لتفادي أخطاء التنقل المبكر
    if (!navState?.key) return;
    const currentRoot = (segments[0] as string) || '';

    // إذا لم تُحلّ المقاطع بعد، لا تقم بأي إعادة توجيه لتجنب وميض/قفزات خاطئة
    if (!segments || !segments[0]) {
      return;
    }
    // ألغينا إعادة التوجيه القسري على الإطلاق البارد، إذ باتت الحماية تعتمد على حالة الموافقة والجلسة
    if (!bootRedirectDone.current) {
      bootRedirectDone.current = true;
    }

    if (!session) {
      // لا تعيد التوجيه فوراً لتجنب وميض/قفزة خاطئة أثناء تحديث الحالة بعد إنشاء متجر
      if (
        !noSessionTimer.current &&
        signedOutRef.current &&
        segments.length > 0 &&
        currentRoot !== 'auth'
      ) {
        noSessionTimer.current = setTimeout(() => {
          if (!session && signedOutRef.current) {
            router.replace('/auth');
          }
          noSessionTimer.current = null;
        }, 1500);
      }
      return;
    } else if (noSessionTimer.current) {
      clearTimeout(noSessionTimer.current);
      noSessionTimer.current = null;
    }

    // انتظر حتى اكتمال فحص الموافقة قبل أي توجيه لتجنب وميض واجهة العميل
    if (!approvalChecked) {
      return;
    }

    // إن كان هناك طلب انضمام قيد المراجعة/مرفوض، امنع الدخول لواجهات التطبيق ووجّه لشاشة الانتظار
    if (approvalPending) {
      if (currentRoot !== 'auth') {
        router.replace('/auth/waiting-approval');
      }
      return;
    }

    // انتظر حتى يتم جلب نوع المستخدم
    if (!userType) return;

    const targetRoot = userType === 'merchant'
      ? '(merchant-tabs)'
      : userType === 'driver'
        ? '(driver-tabs)'
        : userType === 'admin'
          ? 'admin'
          : '(tabs)';

    const safeRoots = new Set(['', '(customer-tabs)', '(driver-tabs)', '(merchant-tabs)', 'admin', '(tabs)', 'auth']);
    if (!safeRoots.has(currentRoot)) {
      return;
    }

    // السماح ببعض صفحات auth أثناء تسجيل الدخول (مثل إعداد المتجر/السائق أو انتظار الموافقة)
    if (currentRoot === 'auth') {
      const second = (segments[1] as string) || '';
      const allowWhileLoggedIn = new Set(['setup-merchant', 'setup-driver', 'kyc-merchant', 'waiting-approval']);
      if (allowWhileLoggedIn.has(second)) {
        return; // لا توجه؛ هذه صفحات إعداد مسموح بها للمستخدمين المسجلين
      }
    }

    // وجّه فقط إذا كنا على جذر خاطئ
    if (currentRoot !== targetRoot) {
      router.replace(`/${targetRoot}` as any);
    }
  }, [loading, session, userType, approvalPending, approvalChecked, segments, router, navState?.key]);

  // ✅ الاستماع لتسجيل الخروج فقط
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        signedOutRef.current = true;
        try {
          const otpPending = await AsyncStorage.getItem('otp_pending_signup');
          if (otpPending === 'true') {
            // أثناء إدخال OTP لا تقم بإعادة التوجيه
            return;
          }
        } catch {}
        const currentRoot = (segments[0] as string) || '';
        if (currentRoot !== 'auth') {
          router.replace('/auth');
        }
      } else if (event === 'SIGNED_IN') {
        signedOutRef.current = false;
      }
    });
    return () => subscription.unsubscribe();
  }, [segments]);

  // ✅ منع الرجوع بزر أندرويد: استخدم تبويبات الأسفل فقط
  useEffect(() => {
    const onBackPress = () => {
      const currentRoot = segments[0] || '';
      // اسمح بالرجوع فقط في شاشة المصادقة (لتنقل داخل auth عند الحاجة)
      if (currentRoot === 'auth') return false;
      // امنع الرجوع في باقي الواجهات (استخدم تبويبات الأسفل)
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [segments]);

  // ✅ عرض شاشة تحميل بعد كل الـ Hooks
  if (loading || (session && !approvalChecked)) {
    return <LoadingScreen message="جاري تحميل بياناتك..." />;
  }

  return <>{children}</>;
}
