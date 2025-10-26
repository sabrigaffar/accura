import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  User,
  Star,
  Car,
  MapPin,
  Phone,
  Clock,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCachedUserRating } from '@/lib/ratingUtils';

interface DriverProfile {
  id: string;
  full_name: string;
  phone_number: string;
  vehicle_type: string;
  vehicle_model?: string;
  vehicle_color?: string;
  license_plate?: string;
  average_rating: number;
  total_earnings: number;
  total_deliveries: number;
  is_online: boolean;
  current_lat?: number;
  current_lng?: number;
  created_at: string;
}

export default function DriverProfileScreen() {
  const { profile } = useAuth();
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      fetchDriverProfile();
      fetchDriverRating();
    }
  }, [profile?.id]);

  const fetchDriverProfile = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('driver_profiles')
        .select(`
          *,
          profile:profiles(full_name, phone_number)
        `)
        .eq('id', profile?.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setDriverProfile({
          id: data.id,
          full_name: data.profile?.full_name || '',
          phone_number: data.profile?.phone_number || '',
          vehicle_type: data.vehicle_type,
          vehicle_model: data.vehicle_model,
          vehicle_color: data.vehicle_color,
          license_plate: data.license_plate,
          average_rating: data.average_rating || 0,
          total_earnings: data.total_earnings || 0,
          total_deliveries: data.total_deliveries || 0,
          is_online: data.is_online || false,
          current_lat: data.current_lat,
          current_lng: data.current_lng,
          created_at: data.created_at,
        });
      }
    } catch (error) {
      console.error('Error fetching driver profile:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحميل بيانات السائق');
    } finally {
      setLoading(false);
    }
  };

  const fetchDriverRating = async () => {
    try {
      if (!profile?.id) return;
      
      const rating = await getCachedUserRating(profile.id);
      setAverageRating(rating.averageRating);
      setTotalReviews(rating.totalReviews);
    } catch (error) {
      console.error('Error fetching driver rating:', error);
    }
  };

  const getVehicleTypeText = (vehicleType?: string) => {
    switch (vehicleType) {
      case 'car': return 'سيارة';
      case 'motorcycle': return 'دراجة نارية';
      case 'bicycle': return 'دراجة';
      default: return vehicleType || 'غير محدد';
    }
  };

  const toggleOnlineStatus = async () => {
    if (!driverProfile) return;
    
    try {
      const newStatus = !driverProfile.is_online;
      
      const { error } = await supabase
        .from('driver_profiles')
        .update({ 
          is_online: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', driverProfile.id);

      if (error) throw error;

      setDriverProfile(prev => prev ? { ...prev, is_online: newStatus } : null);
      
      Alert.alert(
        'نجاح', 
        newStatus ? 'تم تفعيل وضعك على الإنترنت' : 'تم إيقاف وضعك على الإنترنت'
      );
    } catch (error) {
      console.error('Error updating online status:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث الحالة');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.loadingText}>جاري تحميل البيانات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driverProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>لم يتم العثور على بيانات السائق</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>العودة</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ملف السائق</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Driver Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <User size={32} color={colors.white} />
            </View>
          </View>
          
          <Text style={styles.driverName}>{driverProfile.full_name}</Text>
          
          {/* Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={20}
                  color={star <= Math.round(averageRating) ? colors.warning : colors.border}
                  fill={star <= Math.round(averageRating) ? colors.warning : 'transparent'}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>
              {averageRating.toFixed(1)} ({totalReviews} تقييم)
            </Text>
          </View>
          
          {/* Status Toggle */}
          <TouchableOpacity 
            style={[
              styles.statusButton, 
              driverProfile.is_online ? styles.onlineButton : styles.offlineButton
            ]}
            onPress={toggleOnlineStatus}
          >
            <View style={[
              styles.statusIndicator,
              { backgroundColor: driverProfile.is_online ? colors.success : colors.error }
            ]} />
            <Text style={[
              styles.statusText,
              { color: driverProfile.is_online ? colors.success : colors.error }
            ]}>
              {driverProfile.is_online ? 'متصل' : 'غير متصل'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{driverProfile.total_deliveries}</Text>
            <Text style={styles.statLabel}>عدد التوصيلات</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{driverProfile.total_earnings.toFixed(2)} ريال</Text>
            <Text style={styles.statLabel}>إجمالي الأرباح</Text>
          </View>
        </View>

        {/* Vehicle Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Car size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>معلومات المركبة</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>نوع المركبة:</Text>
            <Text style={styles.infoValue}>{getVehicleTypeText(driverProfile.vehicle_type)}</Text>
          </View>
          
          {driverProfile.vehicle_model && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>طراز المركبة:</Text>
              <Text style={styles.infoValue}>{driverProfile.vehicle_model}</Text>
            </View>
          )}
          
          {driverProfile.vehicle_color && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>لون المركبة:</Text>
              <Text style={styles.infoValue}>{driverProfile.vehicle_color}</Text>
            </View>
          )}
          
          {driverProfile.license_plate && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>رقم اللوحة:</Text>
              <Text style={styles.infoValue}>{driverProfile.license_plate}</Text>
            </View>
          )}
        </View>

        {/* Contact Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Phone size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>معلومات الاتصال</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>رقم الجوال:</Text>
            <Text style={styles.infoValue}>{driverProfile.phone_number}</Text>
          </View>
        </View>

        {/* Account Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Clock size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>معلومات الحساب</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>تاريخ الانضمام:</Text>
            <Text style={styles.infoValue}>
              {new Date(driverProfile.created_at).toLocaleDateString('ar-SA')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
  errorText: {
    ...typography.body,
    color: colors.error,
    marginBottom: spacing.md,
  },
  backButton: {
    padding: spacing.sm,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
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
  profileCard: {
    backgroundColor: colors.white,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.md,
  },
  avatarContainer: {
    marginBottom: spacing.md,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverName: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.md,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: spacing.sm,
  },
  ratingText: {
    ...typography.body,
    color: colors.textLight,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  onlineButton: {
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
  },
  offlineButton: {
    borderColor: colors.error,
    backgroundColor: colors.error + '10',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  statusText: {
    ...typography.bodyMedium,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    padding: spacing.md,
    marginHorizontal: spacing.xs,
    borderRadius: borderRadius.md,
    ...shadows.small,
  },
  statValue: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  statLabel: {
    ...typography.caption,
    color: colors.textLight,
  },
  section: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.text,
    marginRight: spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    ...typography.body,
    color: colors.text,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.text,
    textAlign: 'left',
  },
});