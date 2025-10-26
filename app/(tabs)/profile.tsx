import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  User,
  MapPin,
  CreditCard,
  Bell,
  HelpCircle,
  Settings,
  LogOut,
  ChevronLeft,
  Edit3,
  Camera,
  Phone,
  Languages,
  Star,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCachedUserRating } from '@/lib/ratingUtils';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setPhoneNumber(profile.phone_number || '');
      fetchUserRating();
    }
  }, [profile]);

  const fetchUserRating = async () => {
    try {
      if (!profile?.id) return;
      
      const rating = await getCachedUserRating(profile.id);
      setAverageRating(rating.averageRating);
      setTotalReviews(rating.totalReviews);
    } catch (error) {
      console.error('Error fetching user rating:', error);
    }
  };

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من حسابك؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const saveProfile = async () => {
    if (!profile?.id) {
      Alert.alert('خطأ', 'لم يتم تحميل بيانات الملف الشخصي. يُرجى إعادة تسجيل الدخول.');
      return;
    }

    if (!fullName.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال الاسم الكامل');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone_number: phoneNumber.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setEditingProfile(false);
      Alert.alert('نجاح', 'تم تحديث الملف الشخصي بنجاح');
    } catch (error: any) {
      console.error('Profile update error:', error);
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء تحديث الملف الشخصي');
    }
  };

  const menuItems = [
    {
      icon: User,
      label: 'معلومات الحساب',
      onPress: () => router.push('/profile/customer-account-info' as any),
    },
    {
      icon: MapPin,
      label: 'عناويني',
      onPress: () => router.push('/profile/addresses'),
    },
    {
      icon: CreditCard,
      label: 'طرق الدفع',
      onPress: () => router.push('/profile/payment-methods'),
    },
    {
      icon: Bell,
      label: 'الإشعارات',
      onPress: () => router.push('/profile/customer-notifications' as any),
    },
    {
      icon: Settings,
      label: 'الإعدادات',
      onPress: () => router.push('/profile/customer-settings' as any),
    },
    {
      icon: HelpCircle,
      label: 'المساعدة والدعم',
      onPress: () => router.push('/profile/customer-help' as any),
    },
  ];

  // Add profile-specific menu items based on user type
  const profileSpecificItems = [];
  
  if (profile?.user_type === 'driver') {
    profileSpecificItems.push({
      icon: Star,
      label: 'ملف السائق',
      onPress: () => router.push('/profile/driver-profile' as any),
    });
  } else if (profile?.user_type === 'merchant') {
    profileSpecificItems.push({
      icon: Star,
      label: 'ملف المتجر',
      onPress: () => router.push('/profile/merchant-profile' as any),
    });
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>حسابي</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.avatarContainer} onPress={() => {}}>
            <View style={styles.avatar}>
              <User size={32} color={colors.white} />
            </View>
            <View style={styles.cameraIcon}>
              <Camera size={16} color={colors.white} />
            </View>
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{profile?.full_name || 'مستخدم'}</Text>
            <View style={styles.phoneContainer}>
              <Phone size={16} color={colors.textLight} />
              <Text style={styles.userPhone}>{profile?.phone_number || ''}</Text>
            </View>
            
            {/* Display rating for drivers and merchants */}
            {(profile?.user_type === 'driver' || profile?.user_type === 'merchant') && (
              <View style={styles.ratingContainer}>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      color={star <= Math.round(averageRating) ? colors.warning : colors.border}
                      fill={star <= Math.round(averageRating) ? colors.warning : 'transparent'}
                    />
                  ))}
                </View>
                <Text style={styles.ratingText}>
                  {averageRating.toFixed(1)} ({totalReviews} تقييم)
                </Text>
              </View>
            )}
            
            {profile?.user_type && (
              <Text style={styles.userType}>
                {profile.user_type === 'customer' && 'عميل'}
                {profile.user_type === 'driver' && 'سائق'}
                {profile.user_type === 'merchant' && 'تاجر'}
                {profile.user_type === 'admin' && 'مدير'}
              </Text>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => setEditingProfile(true)}
          >
            <Edit3 size={16} color={colors.primary} />
            <Text style={styles.editButtonText}>تعديل</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.menuContainer}>
          {/* Profile-specific items first */}
          {profileSpecificItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={`profile-${index}`}
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View style={styles.menuItemRight}>
                  <ChevronLeft size={20} color={colors.textLight} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <View style={styles.menuIcon}>
                  <Icon size={20} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })}
          
          {profileSpecificItems.length > 0 && (
            <View style={styles.separator} />
          )}
          
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
              >
                <View style={styles.menuItemRight}>
                  <ChevronLeft size={20} color={colors.textLight} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <View style={styles.menuIcon}>
                  <Icon size={20} color={colors.primary} />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <LogOut size={20} color={colors.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <Text style={styles.version}>الإصدار 1.0.0</Text>
      </ScrollView>

      {/* Modal for editing profile */}
      <Modal
        visible={editingProfile}
        animationType="slide"
        onRequestClose={() => setEditingProfile(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setEditingProfile(false)}>
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>تعديل الملف الشخصي</Text>
            <TouchableOpacity onPress={saveProfile}>
              <Text style={styles.saveText}>حفظ</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.modalContent}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>الاسم الكامل</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="الاسم الكامل"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <Text style={styles.label}>رقم الجوال</Text>
              <TextInput
                style={styles.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                placeholder="رقم الجوال"
                keyboardType="phone-pad"
              />
            </View>
          </ScrollView>
        </SafeAreaView>
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
    backgroundColor: colors.white,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
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
    position: 'relative',
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
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.primary,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  userName: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userPhone: {
    ...typography.body,
    color: colors.textLight,
    marginRight: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  starsContainer: {
    flexDirection: 'row',
    marginRight: spacing.xs,
  },
  ratingText: {
    ...typography.caption,
    color: colors.textLight,
  },
  userType: {
    ...typography.caption,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  editButtonText: {
    ...typography.body,
    color: colors.primary,
    marginRight: spacing.xs,
  },
  menuContainer: {
    backgroundColor: colors.white,
    marginBottom: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuIcon: {
    marginLeft: spacing.md,
  },
  menuLabel: {
    ...typography.body,
    color: colors.text,
    marginRight: spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  logoutText: {
    ...typography.bodyMedium,
    color: colors.error,
    marginRight: spacing.sm,
  },
  version: {
    ...typography.caption,
    color: colors.textLight,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
  },
  cancelText: {
    ...typography.body,
    color: colors.textLight,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  saveText: {
    ...typography.body,
    color: colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: spacing.md,
  },
  inputContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.lightGray,
  },
});