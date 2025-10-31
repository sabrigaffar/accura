import { Tabs } from 'expo-router';
import { Home, ShoppingBag, Package, User, Bell, Wallet } from 'lucide-react-native';
import { colors } from '@/constants/theme';

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
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ color, size }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="merchants"
        options={{
          title: 'المتاجر',
          tabBarLabel: 'المتاجر',
          tabBarIcon: ({ color, size }) => <ShoppingBag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'طلباتي',
          tabBarLabel: 'طلباتي',
          tabBarIcon: ({ color, size }) => <Package size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'الإشعارات',
          tabBarLabel: 'الإشعارات',
          tabBarIcon: ({ color, size }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'المحفظة',
          tabBarLabel: 'المحفظة',
          tabBarIcon: ({ color, size }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarLabel: 'حسابي',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
