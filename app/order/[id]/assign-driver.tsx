import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, Phone, Star } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';

interface DriverProfile {
  rating: number;
  total_deliveries: number;
  is_online: boolean;
  vehicle_type: string;
}

interface Profile {
  id: string;
  full_name: string;
  phone_number: string;
  driver_profiles: DriverProfile | DriverProfile[];
}

interface Driver {
  id: string;
  full_name: string;
  phone_number: string;
  rating: number;
  total_deliveries: number;
  is_online: boolean;
  vehicle_type: string;
}

export default function AssignDriverScreen() {
  const { id } = useLocalSearchParams(); // order id
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigning, setAssigning] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchAvailableDrivers();
    }
  }, [id]);

  const fetchAvailableDrivers = async () => {
    try {
      setLoading(true);
      
      // جلب السائقين المتاحين
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          phone_number,
          driver_profiles (
            rating,
            total_deliveries,
            is_online,
            vehicle_type
          )
        `)
        .eq('user_type', 'driver')
        .eq('driver_profiles.is_online', true)
        .eq('is_active', true);

      if (error) throw error;

      // تنسيق البيانات
      const formattedDrivers = data
        .filter((profile: Profile) => profile.driver_profiles)
        .map((profile: Profile) => {
          // Handle the case where driver_profiles might be an array
          const driverProfile = Array.isArray(profile.driver_profiles) 
            ? profile.driver_profiles[0] 
            : profile.driver_profiles;
            
          return {
            id: profile.id,
            full_name: profile.full_name,
            phone_number: profile.phone_number,
            rating: driverProfile?.rating || 0,
            total_deliveries: driverProfile?.total_deliveries || 0,
            is_online: driverProfile?.is_online || false,
            vehicle_type: driverProfile?.vehicle_type || '',
          };
        });

      setDrivers(formattedDrivers);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل قائمة السائقين');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchAvailableDrivers();
  };

  const assignDriverToOrder = async (driverId: string) => {
    if (!id) return;
    
    setAssigning(driverId);
    
    try {
      // تحديث الطلب بتعيين السائق
      const { error } = await supabase
        .from('orders')
        .update({ 
          driver_id: driverId,
          status: 'accepted' // تغيير الحالة إلى مقبول عند تعيين السائق
        })
        .eq('id', id);

      if (error) throw error;

      // إنشاء محادثة للطلب
      const { error: chatError } = await supabase
        .from('chat_conversations')
        .insert({
          order_id: id,
          customer_id: user?.id,
          driver_id: driverId,
        });

      if (chatError) {
        console.warn('Could not create chat conversation:', chatError);
      }

      Alert.alert(
        'نجاح',
        'تم تعيين السائق للطلب بنجاح',
        [
          {
            text: 'موافق',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error('Error assigning driver:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تعيين السائق');
    } finally {
      setAssigning(null);
    }
  };

  const getVehicleTypeText = (vehicleType: string) => {
    switch (vehicleType) {
      case 'car': return 'سيارة';
      case 'motorcycle': return 'دراجة نارية';
      case 'bicycle': return 'دراجة';
      default: return vehicleType;
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>جاري تحميل قائمة السائقين...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تعيين سائق</Text>
      </View>

      <ScrollView 
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {drivers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>لا توجد سائقين متاحين حالياً</Text>
          </View>
        ) : (
          <View style={styles.driversList}>
            {drivers.map(driver => (
              <View key={driver.id} style={styles.driverCard}>
                <View style={styles.driverInfo}>
                  <View style={styles.driverAvatar} />
                  <View style={styles.driverDetails}>
                    <Text style={styles.driverName}>{driver.full_name}</Text>
                    <View style={styles.driverStats}>
                      <View style={styles.statItem}>
                        <Star size={16} color={colors.warning} fill={colors.warning} />
                        <Text style={styles.statText}>{driver.rating.toFixed(1)}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Text style={styles.statText}>طلبات: {driver.total_deliveries}</Text>
                      </View>
                    </View>
                    <View style={styles.driverMeta}>
                      <Text style={styles.metaText}>
                        {getVehicleTypeText(driver.vehicle_type)} • {driver.is_online ? 'متاح' : 'غير متاح'}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[styles.assignButton, assigning === driver.id && styles.assignButtonDisabled]}
                  onPress={() => assignDriverToOrder(driver.id)}
                  disabled={assigning === driver.id}
                >
                  {assigning === driver.id ? (
                    <Text style={styles.assignButtonText}>جاري التعيين...</Text>
                  ) : (
                    <Text style={styles.assignButtonText}>تعيين</Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginRight: 40,
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
  },
  driversList: {
    padding: spacing.md,
  },
  driverCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.small,
  },
  driverInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.lightGray,
    marginRight: spacing.md,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  driverStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  statText: {
    ...typography.caption,
    color: colors.textLight,
    marginLeft: spacing.xs,
  },
  driverMeta: {
    flexDirection: 'row',
  },
  metaText: {
    ...typography.caption,
    color: colors.textLight,
  },
  assignButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  assignButtonDisabled: {
    opacity: 0.6,
  },
  assignButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});