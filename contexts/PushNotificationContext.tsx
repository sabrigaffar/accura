import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Alert } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';
import { router } from 'expo-router';
import { playNotificationSound } from '@/utils/soundPlayer';

// تكوين سلوك الإشعارات
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

interface PushNotificationContextType {
  expoPushToken: string | null;
  notification: Notifications.Notification | null;
  registerForPushNotifications: () => Promise<void>;
  sendTestNotification: () => Promise<void>;
}

const PushNotificationContext = createContext<PushNotificationContextType | undefined>(undefined);

interface PushNotificationProviderProps {
  children: ReactNode;
}

export function PushNotificationProvider({ children }: PushNotificationProviderProps) {
  const { user, userType } = useAuth();
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  const notificationListener = useRef<any>(null);
  const responseListener = useRef<any>(null);

  useEffect(() => {
    // تسجيل تلقائي عند تسجيل الدخول
    if (user) {
      registerForPushNotifications();
    }

    // الاستماع للإشعارات الواردة
    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      console.log('📨 Notification received:', notification);
      setNotification(notification);
      
      // تشغيل صوت التنبيه
      playNotificationSound();
    });

    // الاستماع لنقرات المستخدم على الإشعارات
    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      handleNotificationResponse(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  const handleNotificationResponse = (response: Notifications.NotificationResponse) => {
    const data = response.notification.request.content.data;
    
    // التنقل بناءً على نوع الإشعار
    if (data.type === 'new_order') {
      router.push('/(driver-tabs)');
    } else if (data.type === 'order_update' && data.orderId) {
      router.push('/(driver-tabs)/active-orders');
    }
  };

  const registerForPushNotifications = async () => {
    try {
      // التحقق من أن الجهاز حقيقي (ليس simulator)
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications work only on physical devices');
        return;
      }

      // طلب الأذونات
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      
      if (finalStatus !== 'granted') {
        Alert.alert('تنبيه', 'يرجى السماح بالإشعارات لتلقي الطلبات الجديدة');
        return;
      }

      // الحصول على Push Token (اختياري في Development)
      try {
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
        });
        
        const token = tokenData.data;
        console.log('✅ Push Token:', token);
        setExpoPushToken(token);

        // حفظ Token في قاعدة البيانات
        if (user?.id) {
          await savePushTokenToDatabase(token);
        }
      } catch (tokenError: any) {
        // في Development (Expo Go)، Push Token غير متاح - وهذا طبيعي
        console.log('ℹ️ Push Token not available (Development mode):', tokenError.message);
        console.log('✅ Local notifications will still work!');
        // لا نرمي الخطأ - الإشعارات المحلية تعمل بدون Push Token
      }

      // تكوين قناة الإشعارات لـ Android
      if (Platform.OS === 'android') {
        Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#00B074',
          sound: 'default',
        });
      }
    } catch (error) {
      console.error('❌ Failed to register for push notifications:', error);
    }
  };

  const savePushTokenToDatabase = async (token: string) => {
    try {
      if (userType === 'driver' && user?.id) {
        const { error } = await supabase
          .from('driver_profiles')
          .update({ 
            push_token: token,
            push_enabled: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user?.id);

        if (error) throw error;
        console.log('✅ Push token saved to database (driver_profiles)');
      } else {
        // الأدوار الأخرى تُسجَّل في push_tokens عبر NotificationContext/notificationService
        console.log('ℹ️ Skipping driver_profiles push_token save for non-driver role');
      }
    } catch (error) {
      console.error('❌ Failed to save push token:', error);
    }
  };

  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🎉 إشعار تجريبي',
          body: 'هذا إشعار تجريبي للتأكد من عمل النظام',
          data: { type: 'test' },
          sound: true,
        },
        trigger: null, // فوري
      });
      
      Alert.alert('✅ نجح', 'سيصلك إشعار تجريبي بعد ثانية واحدة');
    } catch (error) {
      console.error('❌ Failed to send test notification:', error);
      Alert.alert('❌ خطأ', 'فشل إرسال الإشعار التجريبي');
    }
  };

  const value: PushNotificationContextType = {
    expoPushToken,
    notification,
    registerForPushNotifications,
    sendTestNotification,
  };

  return (
    <PushNotificationContext.Provider value={value}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const context = useContext(PushNotificationContext);
  if (context === undefined) {
    throw new Error('usePushNotifications must be used within a PushNotificationProvider');
  }
  return context;
}
