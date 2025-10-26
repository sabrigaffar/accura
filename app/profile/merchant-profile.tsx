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
  Store,
  MapPin,
  Phone,
  Clock,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCachedUserRating } from '@/lib/ratingUtils';

interface MerchantProfile {
  id: string;
  name_ar: string;
  description_ar?: string;
  category: string;
  logo_url?: string;
  banner_url?: string;
  rating: number;
  total_reviews: number;
  avg_delivery_time: number;
  min_order_amount: number;
  delivery_fee: number;
  is_open: boolean;
  address: string;
  latitude?: number;
  longitude?: number;
  working_hours?: any;
  is_active: boolean;
  created_at: string;
  owner_id: string;
}

export default function MerchantProfileScreen() {
  const { profile } = useAuth();
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    if (profile?.id) {
      fetchMerchantProfile();
      fetchMerchantRating();
    }
  }, [profile?.id]);

  const fetchMerchantProfile = async () => {
    try {
      setLoading(true);
      
      // محاولة جلب بيانات التاجر من merchant_profiles
      const { data, error } = await supabase
        .from('merchant_profiles')
        .select('*')
        .eq('id', profile?.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching merchant profile:', error);
      }
      
      // إذا لم توجد بيانات، استخدم بيانات افتراضية
      if (data) {
        setMerchantProfile(data as any);
      } else {
        // بيانات افتراضية للتاجر
        setMerchantProfile({
          id: profile?.id || '',
          name_ar: profile?.full_name || 'متجري',
          description_ar: 'مرحباً بك في متجرنا',
          category: 'other',
          rating: 0,
          total_reviews: 0,
          avg_delivery_time: 30,
          min_order_amount: 0,
          delivery_fee: 0,
          is_open: true,
          address: 'الرياض',
          is_active: true,
          created_at: new Date().toISOString(),
          owner_id: profile?.id || '',
        } as any);
      }
    } catch (error) {
      console.error('Error fetching merchant profile:', error);
      // لا تظهر alert للمستخدم - فقط استخدم بيانات افتراضية
      setMerchantProfile({
        id: profile?.id || '',
        name_ar: profile?.full_name || 'متجري',
        description_ar: 'مرحباً بك في متجرنا',
        category: 'other',
        rating: 0,
        total_reviews: 0,
        avg_delivery_time: 30,
        min_order_amount: 0,
        delivery_fee: 0,
        is_open: true,
        address: 'الرياض',
        is_active: true,
        created_at: new Date().toISOString(),
        owner_id: profile?.id || '',
      } as any);
    } finally {
      setLoading(false);
    }
  };

  const fetchMerchantRating = async () => {
    try {
      if (!profile?.id) return;
      
      const rating = await getCachedUserRating(profile.id);
      setAverageRating(rating.averageRating);
      setTotalReviews(rating.totalReviews);
    } catch (error) {
      console.error('Error fetching merchant rating:', error);
    }
  };

  const getCategoryText = (category: string) => {
    switch (category) {
      case 'restaurant': return 'مطعم';
      case 'grocery': return 'بقالة';
      case 'pharmacy': return 'صيدلية';
      case 'gifts': return 'هدايا';
      default: return category;
    }
  };

  const toggleOpenStatus = async () => {
    if (!merchantProfile) return;
    
    try {
      const newStatus = !merchantProfile.is_open;
      
      const { error } = await supabase
        .from('merchants')
        .update({ 
          is_open: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', merchantProfile.id);

      if (error) throw error;

      setMerchantProfile(prev => prev ? { ...prev, is_open: newStatus } : null);
      
      Alert.alert(
        'نجاح', 
        newStatus ? 'تم فتح المتجر' : 'تم إغلاق المتجر'
      );
    } catch (error) {
      console.error('Error updating open status:', error);
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

  if (!merchantProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>لم يتم العثور على بيانات المتجر</Text>
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
        <Text style={styles.headerTitle}>ملف المتجر</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Merchant Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Store size={32} color={colors.white} />
            </View>
          </View>
          
          <Text style={styles.merchantName}>{merchantProfile.name_ar}</Text>
          
          {/* Rating */}
          <View style={styles.ratingContainer}>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  size={20}
                  color={star <= Math.round(merchantProfile.rating) ? colors.warning : colors.border}
                  fill={star <= Math.round(merchantProfile.rating) ? colors.warning : 'transparent'}
                />
              ))}
            </View>
            <Text style={styles.ratingText}>
              {merchantProfile.rating.toFixed(1)} ({merchantProfile.total_reviews} تقييم)
            </Text>
          </View>
          
          {/* Status Toggle */}
          <TouchableOpacity 
            style={[
              styles.statusButton, 
              merchantProfile.is_open ? styles.openButton : styles.closedButton
            ]}
            onPress={toggleOpenStatus}
          >
            <View style={[
              styles.statusIndicator,
              { backgroundColor: merchantProfile.is_open ? colors.success : colors.error }
            ]} />
            <Text style={[
              styles.statusText,
              { color: merchantProfile.is_open ? colors.success : colors.error }
            ]}>
              {merchantProfile.is_open ? 'متجر مفتوح' : 'متجر مغلق'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{merchantProfile.avg_delivery_time} دقيقة</Text>
            <Text style={styles.statLabel}>متوسط وقت التوصيل</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{merchantProfile.min_order_amount.toFixed(2)} ريال</Text>
            <Text style={styles.statLabel}>الحد الأدنى للطلب</Text>
          </View>
        </View>

        {/* Merchant Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Store size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>معلومات المتجر</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الفئة:</Text>
            <Text style={styles.infoValue}>{getCategoryText(merchantProfile.category)}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>رسوم التوصيل:</Text>
            <Text style={styles.infoValue}>{merchantProfile.delivery_fee.toFixed(2)} ريال</Text>
          </View>
          
          {merchantProfile.description_ar && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>الوصف:</Text>
              <Text style={styles.infoValue}>{merchantProfile.description_ar}</Text>
            </View>
          )}
        </View>

        {/* Location Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MapPin size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>الموقع</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>العنوان:</Text>
            <Text style={styles.infoValue}>{merchantProfile.address}</Text>
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
              {new Date(merchantProfile.created_at).toLocaleDateString('ar-SA')}
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
  merchantName: {
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
  openButton: {
    borderColor: colors.success,
    backgroundColor: colors.success + '10',
  },
  closedButton: {
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
    flex: 1,
    marginRight: spacing.md,
  },
});