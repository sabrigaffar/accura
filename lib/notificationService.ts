/**
 * خدمة الإشعارات - Notification Service
 * تدير التسجيل والاستقبال وإرسال الإشعارات
 */

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import type { 
  Notification, 
  CreateNotificationParams, 
  DeviceType,
  NotificationType 
} from '@/types/notification';

// إعدادات الإشعارات الافتراضية
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

class NotificationService {
  private expoPushToken: string | null = null;

  /**
   * تهيئة الإشعارات وطلب الأذونات
   */
  async initialize(): Promise<string | null> {
    try {
      // التحقق من أننا على جهاز حقيقي
      if (!Device.isDevice) {
        console.warn('الإشعارات تعمل فقط على الأجهزة الحقيقية');
        return null;
      }

      // في Expo Go على أندرويد، لا تتوفر الإشعارات البعيدة (SDK 53+)
      if (Platform.OS === 'android' && (Constants as any)?.appOwnership === 'expo') {
        console.warn('Expo Go على أندرويد لا يدعم الإشعارات البعيدة بعد SDK 53. استخدم Development Build (expo-dev-client).');
        return null;
      }

      // طلب الأذونات
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.warn('لم يتم منح إذن الإشعارات');
        return null;
      }

      // الحصول على Push Token من Expo
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: 'c3c8154e-50ce-44a1-b32a-37328206b4a7',
      });

      this.expoPushToken = token.data;

      // إعداد قناة الإشعارات لأندرويد
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('خطأ في تهيئة الإشعارات:', error);
      return null;
    }
  }

  /**
   * تسجيل Push Token في قاعدة البيانات
   */
  async registerPushToken(userId: string): Promise<boolean> {
    try {
      if (!this.expoPushToken) {
        const token = await this.initialize();
        if (!token) return false;
      }

      const deviceType = Platform.OS as DeviceType;
      const deviceName = Device.deviceName || `${Platform.OS} Device`;

      const { error } = await supabase
        .from('push_tokens')
        .upsert({
          user_id: userId,
          token: this.expoPushToken,
          device_type: deviceType,
          device_name: deviceName,
          is_active: true,
        }, {
          onConflict: 'user_id,token'
        });

      if (error) {
        console.error('خطأ في تسجيل Push Token:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('خطأ في تسجيل Push Token:', error);
      return false;
    }
  }

  /**
   * إلغاء تسجيل Push Token
   */
  async unregisterPushToken(userId: string): Promise<boolean> {
    try {
      if (!this.expoPushToken) return false;

      const { error } = await supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('token', this.expoPushToken);

      if (error) {
        console.error('خطأ في إلغاء تسجيل Push Token:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('خطأ في إلغاء تسجيل Push Token:', error);
      return false;
    }
  }

  /**
   * الحصول على جميع الإشعارات للمستخدم
   */
  async getNotifications(userId: string, limit = 50): Promise<Notification[]> {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          id,
          user_id,
          coalesce(title, title_ar, title_en) as title,
          coalesce(body, body_ar, body_en) as body,
          coalesce(type, notification_type) as type,
          data,
          is_read,
          created_at,
          read_at
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return (data as any) || [];
    } catch (error) {
      console.error('خطأ في جلب الإشعارات:', error);
      return [];
    }
  }

  /**
   * الحصول على عدد الإشعارات غير المقروءة
   */
  async getUnreadCount(userId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('خطأ في عد الإشعارات غير المقروءة:', error);
      return 0;
    }
  }

  /**
   * وضع علامة مقروء على إشعار
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في وضع علامة مقروء:', error);
      return false;
    }
  }

  /**
   * وضع علامة مقروء على جميع الإشعارات
   */
  async markAllAsRead(userId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في وضع علامة مقروء على الكل:', error);
      return false;
    }
  }

  /**
   * حذف إشعار
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في حذف الإشعار:', error);
      return false;
    }
  }

  /**
   * إنشاء إشعار جديد (يتم استدعاؤه من الخادم عادة)
   */
  async createNotification(params: CreateNotificationParams): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: params.user_id,
          title: params.title,
          body: params.body,
          type: params.type,
          data: params.data || {},
        });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('خطأ في إنشاء الإشعار:', error);
      return false;
    }
  }

  /**
   * الاشتراك في الإشعارات الواردة
   */
  subscribeToNotifications(
    callback: (notification: Notifications.Notification) => void
  ) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * الاشتراك في الاستجابة للإشعارات (عند النقر عليها)
   */
  subscribeToNotificationResponse(
    callback: (response: Notifications.NotificationResponse) => void
  ) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * الاشتراك في التحديثات الحية للإشعارات من Supabase
   */
  subscribeToRealtimeNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    const channel = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const n: any = payload.new || {};
          const normalized: Notification = {
            id: n.id,
            user_id: n.user_id,
            title: n.title ?? n.title_ar ?? n.title_en ?? '',
            body: n.body ?? n.body_ar ?? n.body_en ?? '',
            type: n.type ?? n.notification_type ?? 'system',
            data: n.data || {},
            is_read: !!n.is_read,
            created_at: n.created_at,
            read_at: n.read_at ?? null,
          };
          callback(normalized);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  /**
   * إرسال إشعار محلي (يظهر على الجهاز فوراً)
   */
  async sendLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): Promise<string> {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // يُرسل فوراً
    });
  }

  /**
   * إلغاء جميع الإشعارات المحلية المعلقة
   */
  async cancelAllLocalNotifications(): Promise<void> {
    await Notifications.cancelAllScheduledNotificationsAsync();
  }

  /**
   * الحصول على Push Token الحالي
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }
}

// تصدير instance واحدة من الخدمة
export const notificationService = new NotificationService();
