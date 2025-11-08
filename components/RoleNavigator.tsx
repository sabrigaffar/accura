import React, { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments, useRootNavigationState } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from './LoadingScreen';

// تعريف الحالات
type RoleState =
  | 'loading'
  | 'otpPending'
  | 'unauthenticated'
  | 'pendingApproval'
  | 'authenticatedMerchant'
  | 'authenticatedDriver'
  | 'authenticatedCustomer';

export function RoleNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const rootNav = useRootNavigationState();
  const { session, userType, loading, approvalPending, approvalChecked } = useAuth();
  const [otpPending, setOtpPending] = useState(false);

  // اقرأ حالة الـ OTP من AsyncStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const flag = await AsyncStorage.getItem('otp_pending_signup');
        if (!cancelled) setOtpPending(flag === 'true');
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [segments]);

  // دالة تحويل الحالة إلى Root
  const redirectToRoot = (state: RoleState) => {
    const currentRoot = (segments[0] as string) || '';

    const stateToRootMap: Record<RoleState, string> = {
      loading: '',
      otpPending: 'auth/signup',
      unauthenticated: 'auth/login',
      pendingApproval: 'auth/waiting-approval',
      authenticatedMerchant: '(merchant-tabs)',
      authenticatedDriver: '(driver-tabs)',
      authenticatedCustomer: '(customer-tabs)',
    };

    const targetRoot = stateToRootMap[state];
    // Build a typed-safe path for expo-router (cast to any to satisfy typed routes)
    const targetPath = (`/${targetRoot}`) as any;

    if (!currentRoot.includes(targetRoot)) {
      console.log('[RoleNavigator] redirecting', { from: currentRoot, to: targetRoot });
      router.replace(targetPath);
    }
  };

  // حساب الحالة الحالية
  const getCurrentState = (): RoleState => {
    if (loading || (session && !approvalChecked)) return 'loading';
    if (otpPending) return 'otpPending';
    if (!session) return 'unauthenticated';
    if (approvalPending) return 'pendingApproval';
    if (userType === 'merchant') return 'authenticatedMerchant';
    if (userType === 'driver') return 'authenticatedDriver';
    return 'authenticatedCustomer';
  };

  // توجيه عند تغير الحالة
  useEffect(() => {
    if (!rootNav?.key) return; // انتظر تحميل الRouter

    const state = getCurrentState();
    redirectToRoot(state);
  }, [loading, session, approvalPending, approvalChecked, userType, rootNav, segments]);

  // منع الرجوع في أندرويد
  useEffect(() => {
    const onBackPress = () => {
      const currentRoot = (segments[0] as string) || '';
      if (currentRoot === 'auth') return false; // السماح بالرجوع داخل auth
      return true; // منع الرجوع في التبويبات
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [segments]);

  // الاستماع لتسجيل الخروج
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_OUT') {
        try {
          const otpPending = await AsyncStorage.getItem('otp_pending_signup');
          if (otpPending === 'true') return;
        } catch {}
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) return;
        } catch {}
        router.replace('/auth/login');
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  // شاشة تحميل
  if (loading || (session && !approvalChecked)) {
    return <LoadingScreen message="جاري تحميل بياناتك..." />;
  }

  return <>{children}</>;
}
