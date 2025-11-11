import { Tabs } from 'expo-router';
import React from 'react';
import { LayoutDashboard, Package, ShoppingCart, TrendingUp, Star, User, Bell, Megaphone } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { ActiveStoreProvider } from '@/contexts/ActiveStoreContext';
import { View } from 'react-native';

export default function MerchantTabsLayout() {
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
