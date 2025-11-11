import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useFonts } from 'expo-font';
import {
  Cairo_400Regular,
  Cairo_600SemiBold,
  Cairo_700Bold,
} from '@expo-google-fonts/cairo';
import {
  Tajawal_400Regular,
  Tajawal_500Medium,
  Tajawal_700Bold,
} from '@expo-google-fonts/tajawal';
import { Lemonada_500Medium } from '@expo-google-fonts/lemonada';
import * as SplashScreen from 'expo-splash-screen';
import { I18nManager } from 'react-native';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { PushNotificationProvider } from '@/contexts/PushNotificationContext';
import { RoleNavigator } from '@/components/RoleNavigator';
import { CartProvider } from '@/contexts/CartContext';
import { refreshBaseFeePerKm } from '@/lib/deliveryFeeCalculator';
import { ToastProvider } from '@/contexts/ToastContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import NetworkBanner from '@/components/NetworkBanner';

SplashScreen.preventAutoHideAsync();

if (!I18nManager.isRTL) {
  I18nManager.forceRTL(true);
  I18nManager.allowRTL(true);
}

export default function RootLayout() {
  useFrameworkReady();

  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_600SemiBold,
    Cairo_700Bold,
    Tajawal_400Regular,
    Tajawal_500Medium,
    Tajawal_700Bold,
    Lemonada_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  // Pre-warm base_fee_per_km cache at app start
  useEffect(() => {
    refreshBaseFeePerKm().catch(() => {});
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <PushNotificationProvider>
          <NotificationProvider>
            <ChatProvider>
              <CartProvider>
                <ToastProvider>
                  <ErrorBoundary>
                    <RoleNavigator>
                      <StatusBar style="auto" />
                      <NetworkBanner />
                      <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />
                    </RoleNavigator>
                  </ErrorBoundary>
                </ToastProvider>
              </CartProvider>
            </ChatProvider>
          </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
