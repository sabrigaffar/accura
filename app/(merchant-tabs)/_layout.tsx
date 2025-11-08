import { Tabs, router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Star, User, Bell, Megaphone } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { ActiveStoreProvider } from '@/contexts/ActiveStoreContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { View, ActivityIndicator } from 'react-native';

export default function MerchantTabsLayout() {
  const { user } = useAuth();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) {
        setAllowed(false);
        setChecking(false);
        return;
      }
      // 1) تحقق من ملف KYC للتاجر على مستوى المالك
      const { data: mp, error: mpErr } = await supabase
        .from('merchant_profiles')
        .select('owner_id, approval_status')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (mpErr) {
        setAllowed(false);
        setChecking(false);
        router.replace('/auth/kyc-merchant' as any);
        return;
      }
      if (!mp) {
        setAllowed(false);
        setChecking(false);
        router.replace('/auth/kyc-merchant' as any);
        return;
      }
      if (mp.approval_status !== 'approved') {
        setAllowed(false);
        setChecking(false);
        router.replace('/auth/waiting-approval' as any);
        return;
      }
      // 2) مسموح: يمكن للتاجر إنشاء متجره بعد الموافقة داخل التبويبات
      setAllowed(true);
      setChecking(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  if (checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!allowed) return null;

  return (
    <ActiveStoreProvider>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textLight,
          tabBarStyle: {
            backgroundColor: colors.white,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            height: 60,
            paddingBottom: 8,
          },
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'لوحة التحكم',
            tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: 'منتجاتي',
            tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'الطلبات',
            tabBarIcon: ({ color, size }) => <ShoppingCart size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'الإحصائيات',
            tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reviews"
          options={{
            title: 'التقييمات',
            tabBarIcon: ({ color, size }) => <Star size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="notifications"
          options={{
            title: 'الإشعارات',
            tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: 'المحفظة',
            tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="ads"
          options={{
            title: 'الإعلانات',
            tabBarIcon: ({ color, size }) => <Megaphone size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: 'حسابي',
            tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
          }}
        />
      </Tabs>
    </ActiveStoreProvider>
  );
}
