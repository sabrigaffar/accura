import { Tabs } from 'expo-router';
import { Home, ShoppingBag, Store, MessageCircle, Tag, User, Bell, Wallet } from 'lucide-react-native';
import { colors, typography } from '@/constants/theme';

export default function TabLayout() {
  return (
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
          tabBarLabel: 'الرئيسية',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="merchants"
        options={{
          title: 'المتاجر',
          tabBarLabel: 'المتاجر',
          tabBarIcon: ({ size, color }) => <Store size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'الطلبات',
          tabBarLabel: 'الطلبات',
          tabBarIcon: ({ size, color }) => <ShoppingBag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'المحادثة',
          tabBarLabel: 'المحادثة',
          tabBarIcon: ({ size, color }) => <MessageCircle size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="offers"
        options={{
          title: 'العروض',
          tabBarLabel: 'العروض',
          tabBarIcon: ({ size, color }) => <Tag size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'الإشعارات',
          tabBarLabel: 'الإشعارات',
          tabBarIcon: ({ size, color }) => <Bell size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'المحفظة',
          tabBarLabel: 'المحفظة',
          tabBarIcon: ({ size, color }) => <Wallet size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'حسابي',
          tabBarLabel: 'حسابي',
          tabBarIcon: ({ size, color }) => <User size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}