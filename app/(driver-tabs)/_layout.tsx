import { Tabs, router } from 'expo-router';
import { Map, Package, TrendingUp, Star, User, Bell, MapPin, CreditCard } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import FloatingChatButton from '@/components/FloatingChatButton';
import ChatSheet from '@/components/ChatSheet';

export default function DriverTabsLayout() {
  const { user } = useAuth();
  const [chatVisible, setChatVisible] = useState(false);
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
    <View style={{ flex: 1 }}>
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
          tabBarLabelStyle: { fontSize: 10 },
          headerShown: false,
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'طلبات',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#06B6D4' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Map size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="active-orders"
        options={{
          title: 'نشطة',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#F59E0B' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: 'أرباح',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#22C55E' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="nearby-map"
        options={{
          title: 'خريطة',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#2563EB' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <MapPin size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'محفظة',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#10B981' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: 'تقييمات',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#FB923C' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Star size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'إشعارات',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#F43F5E' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Bell size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#16A34A' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <User size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      </Tabs>
      {/* Floating Chat Button */}
      <FloatingChatButton onPress={() => setChatVisible(v => !v)} />
      <ChatSheet
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        title="المحادثات"
        fabBottom={Platform.select({ ios: 100, android: 88, default: 88 }) as number}
        fabSize={56}
        gapAboveFab={12}
      />
    </View>
  );
}
