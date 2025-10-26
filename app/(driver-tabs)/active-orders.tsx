import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Package, MapPin, Phone, Navigation, CheckCircle } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ActiveOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  merchant_name: string;
  merchant_address: string;
  delivery_address: string;
  total: number;
  delivery_fee: number;
  status: string;
  items_count: number;
  picked_up_at?: string;
  heading_to_merchant_at?: string;
  heading_to_customer_at?: string;
}

enum DeliveryStep {
  ACCEPTED = 'accepted',
  HEADING_TO_MERCHANT = 'heading_to_merchant',
  PICKED_UP = 'picked_up',
  HEADING_TO_CUSTOMER = 'heading_to_customer',
  DELIVERED = 'delivered',
}

export default function DriverActiveOrders() {
  const { user } = useAuth();
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    fetchActiveOrder();
  }, []);

  const fetchActiveOrder = async () => {
    try {
      setLoading(true);

      if (!user) {
        setLoading(false);
        return;
      }

      // جلب الطلب النشط للسائق الحالي
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          total,
          delivery_fee,
          status,
          picked_up_at,
          heading_to_merchant_at,
          heading_to_customer_at,
          delivery_address:addresses!orders_delivery_address_id_fkey (
            street_address,
            city,
            district
          ),
          customer:profiles!orders_customer_id_fkey (
            full_name,
            phone_number
          ),
          merchant:merchants!orders_merchant_id_fkey (
            name_ar,
            address
          )
        `)
        .eq('driver_id', user.id)
        .eq('status', 'out_for_delivery')
        .single();

      if (orderError) {
        if (orderError.code === 'PGRST116') {
          // No active order found
          setActiveOrder(null);
        } else {
          throw orderError;
        }
      } else if (orderData) {
        // جلب عدد الأصناف
        const { count } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .eq('order_id', orderData.id);

        const customer = Array.isArray(orderData.customer) ? orderData.customer[0] : orderData.customer;
        const merchant = Array.isArray(orderData.merchant) ? orderData.merchant[0] : orderData.merchant;
        const address = Array.isArray(orderData.delivery_address) ? orderData.delivery_address[0] : orderData.delivery_address;

        setActiveOrder({
          id: orderData.id,
          order_number: orderData.order_number,
          customer_name: customer?.full_name || 'عميل',
          customer_phone: customer?.phone_number || '',
          merchant_name: merchant?.name_ar || 'متجر',
          merchant_address: merchant?.address || 'غير محدد',
          delivery_address: address
            ? `${address.street_address}, ${address.district || ''}, ${address.city}`
            : 'غير محدد',
          total: orderData.total,
          delivery_fee: orderData.delivery_fee || 0,
          status: orderData.status,
          items_count: count || 0,
          picked_up_at: orderData.picked_up_at,
          heading_to_merchant_at: orderData.heading_to_merchant_at,
          heading_to_customer_at: orderData.heading_to_customer_at,
        });
      }
    } catch (error) {
      console.error('Error fetching active order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل الطلب النشط');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveOrder();
  };

  const getCurrentStep = (): DeliveryStep => {
    if (!activeOrder) return DeliveryStep.ACCEPTED;
    if (activeOrder.heading_to_customer_at) return DeliveryStep.HEADING_TO_CUSTOMER;
    if (activeOrder.picked_up_at) return DeliveryStep.PICKED_UP;
    if (activeOrder.heading_to_merchant_at) return DeliveryStep.HEADING_TO_MERCHANT;
    return DeliveryStep.ACCEPTED;
  };

  const handleHeadingToMerchant = async () => {
    if (!activeOrder) return;

    try {
      setCompleting(true);
      const { error } = await supabase
        .from('orders')
        .update({
          heading_to_merchant_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrder.id);

      if (error) throw error;

      Alert.alert('تم', 'تم تحديث حالة الطلب');
      fetchActiveOrder();
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الحالة');
    } finally {
      setCompleting(false);
    }
  };

  const handlePickedUp = async () => {
    if (!activeOrder) return;

    Alert.alert(
      'تأكيد الاستلام',
      'هل تم استلام الطلب من المتجر؟',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'نعم',
          onPress: async () => {
            try {
              setCompleting(true);
              const { error } = await supabase
                .from('orders')
                .update({
                  picked_up_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', activeOrder.id);

              if (error) throw error;

              Alert.alert('تم الاستلام', 'الآن يمكنك التوجه للعميل');
              fetchActiveOrder();
            } catch (error) {
              console.error('Error updating order:', error);
              Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الحالة');
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleHeadingToCustomer = async () => {
    if (!activeOrder) return;

    try {
      setCompleting(true);
      const { error } = await supabase
        .from('orders')
        .update({
          heading_to_customer_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrder.id);

      if (error) throw error;

      Alert.alert('تم', 'تم تحديث حالة الطلب');
      fetchActiveOrder();
    } catch (error) {
      console.error('Error updating order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الحالة');
    } finally {
      setCompleting(false);
    }
  };

  const handleCancelOrder = () => {
    setShowCancelModal(true);
  };

  const confirmCancelOrder = async () => {
    if (!activeOrder) return;

    if (!cancelReason.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال سبب الإلغاء');
      return;
    }

    try {
      setCompleting(true);

      // تسجيل الإلغاء في جدول driver_cancellations
      const { error: cancellationError } = await supabase
        .from('driver_cancellations')
        .insert({
          driver_id: user?.id,
          order_id: activeOrder.id,
          reason: cancelReason,
        });

      if (cancellationError) {
        console.error('Error recording cancellation:', cancellationError);
        // نواصل حتى لو فشل التسجيل
      }

      // إعادة الطلب لحالة ready وإزالة السائق
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          driver_id: null,
          status: 'ready',
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeOrder.id);

      if (updateError) throw updateError;

      setShowCancelModal(false);
      setCancelReason('');
      Alert.alert(
        'تم الإلغاء',
        'تم إلغاء الطلب وإعادته للطلبات المتاحة',
        [
          {
            text: 'موافق',
            onPress: () => {
              setActiveOrder(null);
              router.push('/(driver-tabs)');
            },
          },
        ]
      );
    } catch (error) {
      console.error('Error cancelling order:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء إلغاء الطلب');
    } finally {
      setCompleting(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!activeOrder) return;

    Alert.alert(
      'تأكيد التوصيل',
      'هل تم تسليم الطلب للعميل؟',
      [
        { text: 'لا', style: 'cancel' },
        {
          text: 'نعم، تم التسليم',
          onPress: async () => {
            try {
              setCompleting(true);

              // تحديث حالة الطلب إلى delivered
              const { error: updateError } = await supabase
                .from('orders')
                .update({
                  status: 'delivered',
                  delivered_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', activeOrder.id);

              if (updateError) throw updateError;

              // إضافة الأرباح لجدول driver_earnings
              const { error: earningsError } = await supabase
                .from('driver_earnings')
                .insert({
                  driver_id: user?.id,
                  order_id: activeOrder.id,
                  amount: activeOrder.delivery_fee,
                  earned_at: new Date().toISOString(),
                });

              if (earningsError) {
                console.error('Error adding earnings:', earningsError);
                // لا نوقف العملية إذا فشل تسجيل الأرباح
              }

              Alert.alert('تم التوصيل', 'تم تسجيل التوصيل بنجاح وإضافة الأرباح', [
                {
                  text: 'موافق',
                  onPress: () => {
                    setActiveOrder(null);
                    router.push('/(driver-tabs)/earnings');
                  },
                },
              ]);
            } catch (error) {
              console.error('Error completing delivery:', error);
              Alert.alert('خطأ', 'حدث خطأ أثناء تسجيل التوصيل');
            } finally {
              setCompleting(false);
            }
          },
        },
      ]
    );
  };

  const handleCallCustomer = () => {
    if (activeOrder?.customer_phone) {
      const phoneNumber = activeOrder.customer_phone.replace(/[^0-9+]/g, ''); // تنظيف الرقم
      const phoneUrl = `tel:${phoneNumber}`;
      
      Linking.canOpenURL(phoneUrl)
        .then((supported) => {
          if (supported) {
            return Linking.openURL(phoneUrl);
          } else {
            Alert.alert('خطأ', 'لا يمكن إجراء المكالمات على هذا الجهاز');
          }
        })
        .catch((err) => {
          console.error('Error opening phone:', err);
          Alert.alert('خطأ', 'حدث خطأ أثناء محاولة الاتصال');
        });
    } else {
      Alert.alert('خطأ', 'رقم هاتف العميل غير متوفر');
    }
  };

  const handleCallMerchant = () => {
    // في حالة إضافة رقم هاتف التاجر لاحقاً
    Alert.alert('الاتصال بالتاجر', 'سيتم إضافة هذه الميزة قريباً');
  };

  const handleNavigate = () => {
    if (!activeOrder?.delivery_address) {
      Alert.alert('خطأ', 'عنوان التوصيل غير متوفر');
      return;
    }

    // فتح خرائط جوجل مع عنوان التوصيل
    // يمكن تحسينه لاحقاً باستخدام الإحداثيات
    const address = encodeURIComponent(activeOrder.delivery_address);
    const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${address}`;
    
    Linking.canOpenURL(googleMapsUrl)
      .then((supported) => {
        if (supported) {
          return Linking.openURL(googleMapsUrl);
        } else {
          Alert.alert('خطأ', 'لا يمكن فتح الخرائط على هذا الجهاز');
        }
      })
      .catch((err) => {
        console.error('Error opening maps:', err);
        Alert.alert('خطأ', 'حدث خطأ أثناء فتح الخرائط');
      });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>طلباتي النشطة</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>جاري التحميل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeOrder) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>طلباتي النشطة</Text>
        </View>
        <View style={styles.emptyState}>
          <Package size={64} color={colors.textLight} />
          <Text style={styles.emptyTitle}>لا توجد طلبات نشطة</Text>
          <Text style={styles.emptyText}>اقبل طلباً من الطلبات المتاحة لتظهر هنا</Text>
          <TouchableOpacity
            style={styles.goToAvailableButton}
            onPress={() => router.push('/(driver-tabs)')}
          >
            <Text style={styles.goToAvailableText}>عرض الطلبات المتاحة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>طلباتي النشطة</Text>
        <View style={styles.statusBadge}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>جاري التوصيل</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.orderCard}>
          {/* Delivery Steps Progress */}
          <View style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>خطوات التوصيل</Text>
            <View style={styles.stepsProgress}>
              {/* Step 1: Accepted */}
              <View style={styles.stepItem}>
                <View style={[styles.stepCircle, styles.stepCompleted]}>
                  <CheckCircle size={16} color={colors.white} />
                </View>
                <Text style={styles.stepLabel}>تم القبول</Text>
              </View>

              <View style={[styles.stepLine, activeOrder.heading_to_merchant_at && styles.stepLineCompleted]} />

              {/* Step 2: Heading to Merchant */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  activeOrder.heading_to_merchant_at && styles.stepCompleted,
                  getCurrentStep() === DeliveryStep.HEADING_TO_MERCHANT && styles.stepCurrent,
                ]}>
                  {activeOrder.heading_to_merchant_at ? (
                    <CheckCircle size={16} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNumber}>2</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>في الطريق للمتجر</Text>
              </View>

              <View style={[styles.stepLine, activeOrder.picked_up_at && styles.stepLineCompleted]} />

              {/* Step 3: Picked Up */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  activeOrder.picked_up_at && styles.stepCompleted,
                  getCurrentStep() === DeliveryStep.PICKED_UP && styles.stepCurrent,
                ]}>
                  {activeOrder.picked_up_at ? (
                    <CheckCircle size={16} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNumber}>3</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>تم الاستلام</Text>
              </View>

              <View style={[styles.stepLine, activeOrder.heading_to_customer_at && styles.stepLineCompleted]} />

              {/* Step 4: Heading to Customer */}
              <View style={styles.stepItem}>
                <View style={[
                  styles.stepCircle,
                  activeOrder.heading_to_customer_at && styles.stepCompleted,
                  getCurrentStep() === DeliveryStep.HEADING_TO_CUSTOMER && styles.stepCurrent,
                ]}>
                  {activeOrder.heading_to_customer_at ? (
                    <CheckCircle size={16} color={colors.white} />
                  ) : (
                    <Text style={styles.stepNumber}>4</Text>
                  )}
                </View>
                <Text style={styles.stepLabel}>في الطريق للعميل</Text>
              </View>
            </View>
          </View>

          {/* Order Header */}
          <View style={styles.orderHeader}>
            <View style={styles.orderNumberSection}>
              <Package size={20} color={colors.primary} />
              <Text style={styles.orderNumber}>#{activeOrder.order_number}</Text>
            </View>
            <View style={styles.deliveryFeeBadge}>
              <Text style={styles.deliveryFeeText}>أجرة التوصيل: {activeOrder.delivery_fee.toFixed(2)} ر.س</Text>
            </View>
          </View>

          {/* Merchant Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📦 استلام من المتجر</Text>
            <View style={styles.infoCard}>
              <Text style={styles.merchantName}>{activeOrder.merchant_name}</Text>
              <View style={styles.addressRow}>
                <MapPin size={16} color={colors.textLight} />
                <Text style={styles.addressText}>{activeOrder.merchant_address}</Text>
              </View>
            </View>
          </View>

          {/* Customer Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚗 التوصيل للعميل</Text>
            <View style={styles.infoCard}>
              <View style={styles.customerHeader}>
                <Text style={styles.customerName}>{activeOrder.customer_name}</Text>
                {activeOrder.customer_phone && (
                  <TouchableOpacity style={styles.callButton} onPress={handleCallCustomer}>
                    <Phone size={18} color={colors.white} />
                    <Text style={styles.callButtonText}>اتصال</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.addressRow}>
                <MapPin size={16} color={colors.textLight} />
                <Text style={styles.addressText}>{activeOrder.delivery_address}</Text>
              </View>
            </View>
          </View>

          {/* Order Details */}
          <View style={styles.orderDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>عدد الأصناف:</Text>
              <Text style={styles.detailValue}>{activeOrder.items_count}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>إجمالي الطلب:</Text>
              <Text style={styles.detailValue}>{activeOrder.total.toFixed(2)} ر.س</Text>
            </View>
          </View>

          {/* Step Action Buttons */}
          <View style={styles.stepActionsContainer}>
            {getCurrentStep() === DeliveryStep.ACCEPTED && (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={handleHeadingToMerchant}
                disabled={completing}
              >
                <Text style={styles.stepActionButtonText}>🚗 بدء التوجه للمتجر</Text>
              </TouchableOpacity>
            )}

            {getCurrentStep() === DeliveryStep.HEADING_TO_MERCHANT && (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={handlePickedUp}
                disabled={completing}
              >
                <Text style={styles.stepActionButtonText}>✅ تم الاستلام من المتجر</Text>
              </TouchableOpacity>
            )}

            {getCurrentStep() === DeliveryStep.PICKED_UP && (
              <TouchableOpacity
                style={styles.stepActionButton}
                onPress={handleHeadingToCustomer}
                disabled={completing}
              >
                <Text style={styles.stepActionButtonText}>🚗 بدء التوجه للعميل</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Cancel Order Button */}
          <TouchableOpacity
            style={styles.cancelOrderButton}
            onPress={handleCancelOrder}
            disabled={completing}
          >
            <Text style={styles.cancelOrderButtonText}>إلغاء الطلب (طارئ)</Text>
          </TouchableOpacity>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.navigateButton} onPress={handleNavigate}>
              <Navigation size={20} color={colors.white} />
              <Text style={styles.navigateButtonText}>التنقل</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.completeButton,
                completing && styles.completeButtonDisabled,
                getCurrentStep() !== DeliveryStep.HEADING_TO_CUSTOMER && styles.completeButtonDisabled,
              ]}
              onPress={handleCompleteDelivery}
              disabled={completing || getCurrentStep() !== DeliveryStep.HEADING_TO_CUSTOMER}
            >
              {completing ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <CheckCircle size={20} color={colors.white} />
                  <Text style={styles.completeButtonText}>تم التسليم</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Cancel Order Modal */}
      <Modal
        visible={showCancelModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCancelModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إلغاء الطلب</Text>
            <Text style={styles.modalDescription}>
              يرجى إدخال سبب إلغاء الطلب. سيتم إعادة الطلب للطلبات المتاحة.
            </Text>
            
            <TextInput
              style={styles.cancelReasonInput}
              placeholder="مثال: عطل في السيارة، حالة طارئة، إلخ..."
              placeholderTextColor={colors.textLight}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
              >
                <Text style={styles.modalCancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalConfirmButton]}
                onPress={confirmCancelOrder}
                disabled={completing}
              >
                {completing ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.modalConfirmButtonText}>تأكيد الإلغاء</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.secondary,
    marginRight: spacing.xs,
  },
  statusText: {
    ...typography.caption,
    color: colors.secondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.md,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.lg,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  goToAvailableButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.lg,
  },
  goToAvailableText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  content: {
    flex: 1,
  },
  orderCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.medium,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  orderNumberSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  orderNumber: {
    ...typography.h3,
    color: colors.text,
  },
  deliveryFeeBadge: {
    backgroundColor: colors.success + '15',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  deliveryFeeText: {
    ...typography.bodyMedium,
    color: colors.success,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  infoCard: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  merchantName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  customerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  customerName: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  callButtonText: {
    ...typography.caption,
    color: colors.white,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
  },
  addressText: {
    ...typography.body,
    color: colors.textLight,
    flex: 1,
    lineHeight: 20,
  },
  orderDetails: {
    backgroundColor: colors.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    ...typography.body,
    color: colors.textLight,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  navigateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  navigateButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  completeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  completeButtonDisabled: {
    opacity: 0.6,
  },
  completeButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  stepsContainer: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  stepsTitle: {
    ...typography.h3,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  stepsProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
  },
  stepCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.lightGray,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  stepCompleted: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  stepCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stepNumber: {
    ...typography.caption,
    color: colors.textLight,
    fontWeight: 'bold',
  },
  stepLabel: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    fontSize: 10,
  },
  stepLine: {
    height: 2,
    flex: 0.5,
    backgroundColor: colors.border,
    marginHorizontal: -spacing.sm,
  },
  stepLineCompleted: {
    backgroundColor: colors.success,
  },
  stepActionsContainer: {
    marginBottom: spacing.md,
  },
  stepActionButton: {
    backgroundColor: colors.secondary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  stepActionButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
  cancelOrderButton: {
    backgroundColor: colors.error + '20',
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  cancelOrderButtonText: {
    ...typography.body,
    color: colors.error,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  modalDescription: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.md,
    textAlign: 'center',
    lineHeight: 20,
  },
  cancelReasonInput: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    minHeight: 100,
    marginBottom: spacing.md,
    textAlign: 'right',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalCancelButtonText: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  modalConfirmButton: {
    backgroundColor: colors.error,
  },
  modalConfirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});
