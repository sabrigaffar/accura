import React from 'react';
import { Tabs } from 'expo-router';
import { Home, ShoppingBag, Store, Tag, User, Bell, CreditCard } from 'lucide-react-native';
import { colors, typography } from '@/constants/theme';
import { View, Platform } from 'react-native';
import FloatingChatButton from '@/components/FloatingChatButton';
import ChatSheet from '@/components/ChatSheet';

export default function TabLayout() {
  const [chatVisible, setChatVisible] = React.useState(false);
  return (
    <View style={{ flex: 1 }}>
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarLabelStyle: {
          ...typography.small,
          fontSize: 11,
        },
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
          borderTopWidth: 1,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#06B6D4' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Home size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="merchants"
        options={{
          title: 'المتاجر',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#F59E0B' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Store size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
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
              <ShoppingBag size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      {/* Hide chat tab from bottom bar, accessible via floating button */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      {/* Arabic labels for wallet and notifications */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'المحفظة',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#6366F1' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <CreditCard size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
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
        name="offers"
        options={{
          title: 'العروض',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#F43F5E' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
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
    {/* Floating Chat Button + Sheet */}
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
  );
}