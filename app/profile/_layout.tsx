import { Stack } from 'expo-router';
import { ActiveStoreProvider } from '@/contexts/ActiveStoreContext';

export default function ProfileLayout() {
  return (
    <ActiveStoreProvider>
      <Stack>
        <Stack.Screen name="addresses" options={{ title: 'عناويني' }} />
        <Stack.Screen name="payment-methods" options={{ title: 'طرق الدفع' }} />
        <Stack.Screen name="notifications" options={{ title: 'الإشعارات' }} />
        <Stack.Screen name="language" options={{ title: 'اللغة' }} />
        <Stack.Screen name="support" options={{ title: 'المساعدة والدعم' }} />
        <Stack.Screen name="settings" options={{ title: 'الإعدادات' }} />
        <Stack.Screen name="complaints" options={{ title: 'الشكاوى' }} />
        <Stack.Screen name="driver-profile" options={{ title: 'ملف السائق' }} />
        <Stack.Screen name="merchant-profile" options={{ title: 'ملف المتجر' }} />
      </Stack>
    </ActiveStoreProvider>
  );
}