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
import * as SplashScreen from 'expo-splash-screen';
import { I18nManager } from 'react-native';
import { AuthProvider } from '@/contexts/AuthContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ChatProvider } from '@/contexts/ChatContext';
import { RoleNavigator } from '@/components/RoleNavigator';

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
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AuthProvider>
      <NotificationProvider>
        <ChatProvider>
          <RoleNavigator>
            <StatusBar style="auto" />
            <Stack screenOptions={{ headerShown: false }} />
          </RoleNavigator>
        </ChatProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}
