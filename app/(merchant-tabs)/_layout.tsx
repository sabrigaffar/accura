import { Tabs } from 'expo-router';
import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Star, User, Bell, Megaphone } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { ActiveStoreProvider } from '@/contexts/ActiveStoreContext';
import { View, Platform } from 'react-native';
import FloatingChatButton from '@/components/FloatingChatButton';
import ChatSheet from '@/components/ChatSheet';

export default function MerchantTabsLayout() {
  const [chatVisible, setChatVisible] = React.useState(false);
  return (
    <ActiveStoreProvider>
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
          headerShown: false,
        }}
        >
        <Tabs.Screen
          name="index"
          options={{
            title: 'لوحة التحكم',
            tabBarIcon: ({ focused }) => (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#06B6D4' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <LayoutDashboard size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="products"
          options={{
            title: 'منتجاتي',
            tabBarIcon: ({ focused }) => (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#F59E0B' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="orders"
          options={{
            title: 'الطلبات',
            tabBarIcon: ({ focused }) => (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#10B981' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="analytics"
          options={{
            title: 'الإحصائيات',
            tabBarIcon: ({ focused }) => (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#6366F1' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="reviews"
          options={{
            title: 'التقييمات',
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
            title: 'الإشعارات',
            tabBarIcon: ({ focused }) => (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#F43F5E' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Bell size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="wallet"
          options={{
            title: 'المحفظة',
            tabBarIcon: ({ focused }) => (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#22C55E' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
              </View>
            ),
          }}
        />
        <Tabs.Screen
          name="ads"
          options={{
            title: 'الإعلانات',
            tabBarIcon: ({ focused }) => (
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#8B5CF6' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Megaphone size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
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
        {/* Floating Chat Button and Chat Sheet */}
        <FloatingChatButton onPress={() => setChatVisible(v => !v)} />
        <ChatSheet
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          title="المحادثات"
          fabBottom={Platform.select({ ios: 100, android: 88, default: 88 }) as number}
          fabSize={56}
          gapAboveFab={8}
        />
      </View>
    </ActiveStoreProvider>
  );
}
