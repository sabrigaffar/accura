import { Tabs } from 'expo-router';
import { Home, ShoppingBag, Package, User, Bell } from 'lucide-react-native';
import { colors } from '@/constants/theme';
import { View } from 'react-native';

export default function CustomerTabsLayout() {
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
              <ShoppingBag size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'طلباتي',
          tabBarIcon: ({ focused }) => (
            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: focused ? '#10B981' : '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} color={focused ? '#FFFFFF' : '#9CA3AF'} />
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
  );
}
