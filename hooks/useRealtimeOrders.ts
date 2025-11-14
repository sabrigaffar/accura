/**
 * Real-time Orders Hook
 * Provides real-time updates for orders using Supabase Realtime
 */

import { useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { playNotificationSound } from '@/utils/soundPlayer';

export type OrderEventType = 'INSERT' | 'UPDATE' | 'DELETE';
export type UserRole = 'driver' | 'merchant' | 'customer';

interface UseRealtimeOrdersProps {
  userId: string;
  role: UserRole;
  onOrderEvent?: (event: OrderEventType, order: any) => void;
  merchantIds?: string[]; // للتاجر: قائمة معرفات المتاجر
  playSound?: boolean;
}

/**
 * Hook للاشتراك في تحديثات الطلبات في الوقت الفعلي
 * يدعم السائق والتاجر والعميل
 */
export const useRealtimeOrders = ({
  userId,
  role,
  onOrderEvent,
  merchantIds = [],
  playSound = true,
}: UseRealtimeOrdersProps) => {
  
  const handleOrderChange = useCallback((payload: any) => {
    console.log(`🔔 [${role}] Real-time order event:`, payload.eventType, payload.new);
    
    // تشغيل صوت الإشعار
    if (playSound) {
      playNotificationSound();
    }
    
    // استدعاء callback المخصص
    if (onOrderEvent) {
      onOrderEvent(payload.eventType as OrderEventType, payload.new);
    }
  }, [role, onOrderEvent, playSound]);

  useEffect(() => {
    // تحقق من وجود userId قبل بدء الاشتراك
    if (!userId) {
      console.warn('⚠️ [useRealtimeOrders] No userId provided, skipping subscription');
      return;
    }

    // تحقق من وجود merchantIds للتاجر
    if (role === 'merchant' && merchantIds.length === 0) {
      console.warn('⚠️ [useRealtimeOrders] No merchant IDs provided for merchant role');
      return;
    }

    let channel: any;
    let isSubscribed = true;

    // إعداد الاشتراك حسب الدور
    if (role === 'driver') {
      // السائق: الاستماع لعروض الطلبات الموجّهة إليه بدل بث جميع pending
      console.log('🚗 [Driver] Setting up targeted real-time subscription (offers)...');
      channel = supabase
        .channel('driver_orders')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'driver_order_offers',
            filter: `driver_id=eq.${userId}`, // عروض موجّهة لهذا السائق فقط
          },
          async (payload: any) => {
            try {
              const offer = payload?.new;
              const orderId = offer?.order_id;
              if (!orderId) return;
              // جلب تفاصيل الطلب عبر RPC يراعي RLS (لأن السائق لم يُسند بعد)
              const { data: rows, error } = await supabase
                .rpc('get_order_for_offer', { p_order_id: orderId });
              const order = Array.isArray(rows) ? rows[0] : rows;
              if (error || !order) {
                console.warn('⚠️ failed to fetch order for offer', error);
                return;
              }
              handleOrderChange({ eventType: 'INSERT', new: order });
            } catch (e) {
              console.warn('⚠️ offer handler error', e);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `driver_id=eq.${userId}`, // الطلبات المسندة للسائق
          },
          handleOrderChange
        )
        .subscribe((status) => {
          console.log('🚗 [Driver] Subscription status:', status);
        });
    } 
    else if (role === 'merchant') {
      // التاجر: الاستماع لطلبات متاجره
      if (merchantIds.length === 0) {
        console.warn('⚠️ [Merchant] No merchant IDs provided');
        return;
      }
      
      console.log('🏪 [Merchant] Setting up real-time subscription for stores:', merchantIds);
      const merchantFilter = `merchant_id=in.(${merchantIds.join(',')})`;
      
      channel = supabase
        .channel('merchant_orders')
        .on(
          'postgres_changes',
          {
            event: '*', // جميع الأحداث (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'orders',
            filter: merchantFilter,
          },
          handleOrderChange
        )
        .subscribe((status) => {
          console.log('🏪 [Merchant] Subscription status:', status);
        });
    } 
    else if (role === 'customer') {
      // العميل: الاستماع لطلباته
      console.log('👤 [Customer] Setting up real-time subscription...');
      channel = supabase
        .channel('customer_orders')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `customer_id=eq.${userId}`,
          },
          handleOrderChange
        )
        .subscribe((status) => {
          console.log('👤 [Customer] Subscription status:', status);
        });
    }

    // تنظيف الاشتراك عند إلغاء التثبيت
    return () => {
      isSubscribed = false;
      if (channel) {
        console.log(`🔌 [${role}] Unsubscribing from real-time orders...`);
        supabase.removeChannel(channel);
      }
    };
  }, [userId, role, JSON.stringify(merchantIds)]); // استخدام JSON.stringify لمقارنة المصفوفات
};

/**
 * Hook للاشتراك في إشعارات الطلبات للسائق
 */
export const useDriverRealtimeOrders = (
  driverId: string,
  onNewOrder?: (order: any) => void,
  onOrderUpdate?: (order: any) => void
) => {
  return useRealtimeOrders({
    userId: driverId,
    role: 'driver',
    onOrderEvent: (event, order) => {
      if (event === 'INSERT' && onNewOrder) {
        onNewOrder(order);
      } else if (event === 'UPDATE' && onOrderUpdate) {
        onOrderUpdate(order);
      }
    },
  });
};

/**
 * Hook للاشتراك في إشعارات الطلبات للتاجر
 */
export const useMerchantRealtimeOrders = (
  userId: string,
  merchantIds: string[],
  onOrderEvent?: (event: OrderEventType, order: any) => void
) => {
  return useRealtimeOrders({
    userId,
    role: 'merchant',
    merchantIds,
    onOrderEvent,
  });
};

/**
 * Hook للاشتراك في إشعارات الطلبات للعميل
 */
export const useCustomerRealtimeOrders = (
  customerId: string,
  onOrderStatusChange?: (order: any) => void
) => {
  return useRealtimeOrders({
    userId: customerId,
    role: 'customer',
    onOrderEvent: (event, order) => {
      if (event === 'UPDATE' && onOrderStatusChange) {
        onOrderStatusChange(order);
      }
    },
  });
};
