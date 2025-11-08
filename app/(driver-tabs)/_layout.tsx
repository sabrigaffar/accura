import { Tabs, router } from 'expo-router';
import { Map, Package, TrendingUp, Star, User, Bell } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function DriverTabsLayout() {
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
      const { data, error } = await supabase
        .from('driver_profiles')
        .select('approval_status')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setAllowed(false);
        setChecking(false);
        router.replace('/auth/setup-driver' as any);
        return;
      }
      if (!data) {
        setAllowed(false);
        setChecking(false);
        router.replace('/auth/setup-driver' as any);
        return;
      }
      if (data.approval_status !== 'approved') {
        setAllowed(false);
        setChecking(false);
        router.replace('/auth/waiting-approval' as any);
        return;
      }
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

  if (!allowed) {
    return null;
  }

  return (
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
          title: 'الطلبات المتاحة',
          tabBarIcon: ({ color, size }) => <Map size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="active-orders"
        options={{
          title: 'طلباتي النشطة',
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'أرباحي',
          tabBarIcon: ({ color, size }) => <TrendingUp size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'تقييماتي',
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
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
