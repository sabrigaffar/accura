import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  Switch,
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
  Key,
  Moon,
} from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCachedUserRating } from '@/lib/ratingUtils';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileScreen() {
  const { profile, signOut, refreshProfile } = useAuth();
  const { theme, isDark, toggleTheme } = useTheme();
  const [editingProfile, setEditingProfile] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(profile?.phone_number || '');
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);

  const styles = useMemo(() => createStyles(theme), [theme]);

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
      icon: Key,
      label: 'تغيير كلمة المرور',
      onPress: () => router.push('/settings/change-password' as any),
    },
    {
      icon: Bell,
      label: 'الإشعارات',
      onPress: () => router.push('/profile/customer-notifications' as any),
    },
    {
      icon: Moon,
      label: 'الوضع الليلي',
      onPress: () => {},
      isToggle: true,
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
              <User size={40} color="#FFFFFF" />
            </View>
            <View style={styles.cameraIcon}>
              <Camera size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <Text style={styles.userName}>{profile?.full_name || 'مستخدم'}</Text>
            <View style={styles.phoneContainer}>
              <Phone size={14} color={theme.textLight} />
              <Text style={styles.userPhone}>{profile?.phone_number || ''}</Text>
            </View>
            
            {/* Display rating for drivers and merchants */}
            {(profile?.user_type === 'driver' || profile?.user_type === 'merchant') && (
              <View style={styles.ratingContainer}>
                <View style={styles.starsContainer}>
                  {[1, 2, 3, 4, 5].map((star, i) => (
                    <Star
                      key={i}
                      size={16}
                      fill={i < Math.floor(averageRating) ? theme.warning : 'none'}
                      color={theme.warning}
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
            <Edit3 size={16} color={theme.primary} />
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
                  <ChevronLeft size={20} color={theme.textLight} />
                  <Text style={styles.menuLabel}>{item.label}</Text>
                </View>
                <View style={styles.menuIcon}>
                  <Icon size={20} color={theme.primary} />
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
              <View key={index}>
                {(item as any).isToggle ? (
                  <View style={styles.menuItem}>
                    <View style={styles.menuItemRight}>
                      <item.icon size={22} color={theme.textLight} style={styles.menuIcon} />
                      <Text style={styles.menuLabel}>{item.label}</Text>
                    </View>
                    <Switch
                      value={isDark}
                      onValueChange={toggleTheme}
                      trackColor={{ false: theme.border, true: theme.primary }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={item.onPress}
                  >
                    <View style={styles.menuItemRight}>
                      <item.icon size={22} color={theme.textLight} style={styles.menuIcon} />
                      <Text style={styles.menuLabel}>{item.label}</Text>
                    </View>
                    <ChevronLeft size={20} color={theme.textLight} />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <LogOut size={22} color={theme.error} />
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

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    backgroundColor: theme.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    ...typography.h2,
    color: theme.text,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  profileCard: {
    backgroundColor: theme.surface,
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
    backgroundColor: theme.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.primary,
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
    color: theme.text,
    marginBottom: spacing.xs,
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userPhone: {
    ...typography.body,
    color: theme.textLight,
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
    color: theme.textLight,
  },
  userType: {
    ...typography.caption,
    color: theme.primary,
    marginTop: spacing.xs,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.lightGray,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  editButtonText: {
    ...typography.body,
    color: theme.primary,
    marginRight: spacing.xs,
  },
  menuContainer: {
    backgroundColor: theme.surface,
    marginBottom: spacing.md,
  },
  separator: {
    height: 1,
    backgroundColor: theme.border,
    marginHorizontal: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
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
    color: theme.text,
    marginRight: spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.surface,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  logoutText: {
    ...typography.bodyMedium,
    color: theme.error,
    marginRight: spacing.sm,
  },
  version: {
    ...typography.caption,
    color: theme.textLight,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.surface,
  },
  cancelText: {
    ...typography.body,
    color: theme.textLight,
  },
  modalTitle: {
    ...typography.h3,
    color: theme.text,
  },
  saveText: {
    ...typography.body,
    color: theme.primary,
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
    color: theme.text,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: theme.lightGray,
  },
});