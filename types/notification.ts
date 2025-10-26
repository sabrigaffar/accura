/**
 * أنواع البيانات لنظام الإشعارات
 */

export type NotificationType = 
  | 'order'
  | 'message'
  | 'system'
  | 'promotion'
  | 'review'
  | 'status_update';

export type DeviceType = 'ios' | 'android' | 'web';

export interface PushToken {
  id: string;
  user_id: string;
  token: string;
  device_type: DeviceType;
  device_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  data: Record<string, any>;
  type: NotificationType;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface CreateNotificationParams {
  user_id: string;
  title: string;
  body: string;
  type: NotificationType;
  data?: Record<string, any>;
}

export interface PendingPushEvent {
  id: string;
  event_type: 'new_message' | 'new_notification';
  target_user_id: string;
  payload: Record<string, any>;
  is_sent: boolean;
  created_at: string;
}
