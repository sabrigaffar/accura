/**
 * NotificationContext - إدارة حالة الإشعارات عبر التطبيق
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { notificationService } from '@/lib/notificationService';
import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/notification';
import { useAuth } from '@/contexts/AuthContext';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  refreshNotifications: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  deleteNotification: (notificationId: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const { session } = useAuth();

  // تهيئة الإشعارات عند تغيّر المستخدم
  useEffect(() => {
    const uid = session?.user?.id ?? null;
    setUserId(uid);

    let cancelled = false;
    const run = async () => {
      try {
        if (!uid) {
          // عند تسجيل الخروج نفّرغ الحالة
          setNotifications([]);
          setUnreadCount(0);
          return;
        }
        // تهيئة خدمة الإشعارات وتسجيل التوكن
        await notificationService.initialize();
        await notificationService.registerPushToken(uid);
        // جلب الإشعارات الحالية
        await loadNotifications(uid);
      } catch (error) {
        console.error('خطأ في تهيئة الإشعارات:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  // تحميل الإشعارات
  const loadNotifications = async (uid: string) => {
    try {
      const [notifs, count] = await Promise.all([
        notificationService.getNotifications(uid),
        notificationService.getUnreadCount(uid),
      ]);

      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('خطأ في تحميل الإشعارات:', error);
    }
  };

  // تحديث الإشعارات
  const refreshNotifications = useCallback(async () => {
    if (!userId) return;
    await loadNotifications(userId);
  }, [userId]);

  // وضع علامة مقروء
  const markAsRead = useCallback(async (notificationId: string) => {
    const success = await notificationService.markAsRead(notificationId);
    if (success && userId) {
      await loadNotifications(userId);
    }
  }, [userId]);

  // وضع علامة مقروء على الكل
  const markAllAsRead = useCallback(async () => {
    if (!userId) return;
    const success = await notificationService.markAllAsRead(userId);
    if (success) {
      await loadNotifications(userId);
    }
  }, [userId]);

  // حذف إشعار
  const deleteNotification = useCallback(async (notificationId: string) => {
    const success = await notificationService.deleteNotification(notificationId);
    if (success && userId) {
      await loadNotifications(userId);
    }
  }, [userId]);

  // الاشتراك في الإشعارات الواردة
  useEffect(() => {
    // الاستماع للإشعارات الواردة
    const notificationListener = notificationService.subscribeToNotifications(
      (notification) => {
        console.log('إشعار وارد:', notification);
      }
    );

    // الاستماع للاستجابة للإشعارات (عند النقر)
    const responseListener = notificationService.subscribeToNotificationResponse(
      (response) => {
        console.log('تم النقر على الإشعار:', response);
        // يمكن إضافة navigation هنا حسب نوع الإشعار
      }
    );

    return () => {
      notificationListener.remove();
      responseListener.remove();
    };
  }, []);

  // الاشتراك في التحديثات الحية من Supabase
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = notificationService.subscribeToRealtimeNotifications(
      userId,
      async (notification) => {
        console.log('إشعار جديد من Supabase:', notification);
        
        // إضافة الإشعار للقائمة
        setNotifications((prev) => [notification, ...prev]);
        setUnreadCount((prev) => prev + 1);

        // إرسال إشعار محلي
        await notificationService.sendLocalNotification(
          notification.title,
          notification.body,
          notification.data
        );
      }
    );

    return () => {
      unsubscribe();
    };
  }, [userId]);

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    loading,
    refreshNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
