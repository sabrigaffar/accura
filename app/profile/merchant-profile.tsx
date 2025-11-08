import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
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
  Edit3,
} from 'lucide-react-native';
import { Linking } from 'react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { StoreButton } from '@/components/StoreSelector';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getCachedUserRating } from '@/lib/ratingUtils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocation } from '@/hooks/useLocation';
import { ActivityIndicator, Image } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { uploadSingleImage } from '@/lib/imageUpload';

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
  phone_number?: string;
  latitude?: number;
  longitude?: number;
  working_hours?: any;
  is_active: boolean;
  created_at: string;
  owner_id: string;
}

export default function MerchantProfileScreen() {
  const { profile } = useAuth();
  const { activeStore, stores, isAllStoresSelected } = useActiveStore();
  const location = useLocation();
  const [merchantProfile, setMerchantProfile] = useState<MerchantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [editing, setEditing] = useState(false);
  // تم إزالة localDeliveryFee - رسوم التوصيل تُحسب تلقائياً بالمسافة
  const [localMinOrder, setLocalMinOrder] = useState('');
  const [localAvgTime, setLocalAvgTime] = useState('');
  const [localDescription, setLocalDescription] = useState('');
  const [localPhone, setLocalPhone] = useState('');
  const [currency, setCurrency] = useState('ريال');
  const [uploadingImage, setUploadingImage] = useState<'logo' | 'banner' | null>(null);
  const [updatingLocation, setUpdatingLocation] = useState(false);

  useEffect(() => {
    loadCurrency();
  }, []);

  useEffect(() => {
    if (profile?.id && (activeStore || isAllStoresSelected)) {
      fetchMerchantProfile();
      fetchMerchantRating();
    }
  }, [profile?.id, activeStore, isAllStoresSelected]);

  // تحديد الموقع تلقائياً عند تحميل المتجر إذا لم يكن محدد
  useEffect(() => {
    if (merchantProfile && !merchantProfile.latitude && !merchantProfile.longitude) {
      // الموقع غير محدد - نحاول تحديده تلقائياً
      autoSetLocationOnFirstLoad();
    }
  }, [merchantProfile?.id]);

  const loadCurrency = async () => {
    try {
      const symbol = await AsyncStorage.getItem('app_currency_symbol');
      setCurrency(symbol || 'ريال');
    } catch (error) {
      console.error('Error loading currency:', error);
    }
  };

  useEffect(() => {
    if (merchantProfile) {
      // تم إزالة setLocalDeliveryFee - رسوم التوصيل تُحسب تلقائياً
      setLocalMinOrder(String(merchantProfile.min_order_amount ?? 0));
      setLocalAvgTime(String(merchantProfile.avg_delivery_time ?? 30));
      setLocalDescription(merchantProfile.description_ar || '');
      setLocalPhone(merchantProfile.phone_number || '');
    }
  }, [merchantProfile]);

  const fetchMerchantProfile = async () => {
    try {
      setLoading(true);
      
      // جلب بيانات المتجر النشط أو المتجر الأول
      let query = supabase
        .from('merchants')
        .select('*')
        .eq('owner_id', profile?.id);

      // إذا كان متجر محدد، نجلبه تحديداً
      if (activeStore && !isAllStoresSelected) {
        query = query.eq('id', activeStore.id);
      }

      const { data, error } = await query.maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching merchant profile:', error);
      }

      if (data) {
        let merchantData = data as any;

        // إذا لم يوجد عنوان في merchants، حاول جلب العنوان الافتراضي من addresses
        if (!merchantData.address) {
          const { data: addr } = await supabase
            .from('addresses')
            .select('street_address, city, district, building_number')
            .eq('user_id', profile?.id)
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
            .maybeSingle();

          if (addr) {
            const parts = [addr.city, addr.district, addr.street_address]
              .filter(Boolean)
              .join(', ');
            const formatted = addr.building_number ? `${parts}, عمارة ${addr.building_number}` : parts;
            merchantData.address = formatted;
          }
        }

        setMerchantProfile(merchantData);
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

  const handleSaveInfo = async () => {
    if (!merchantProfile) return;
    try {
      // تم إزالة delivery_fee - يُحسب تلقائياً بالمسافة
      const minOrder = parseFloat(localMinOrder || '0');
      const avgTime = parseInt(localAvgTime || '30');

      if (minOrder < 0 || avgTime <= 0) {
        Alert.alert('خطأ', 'تأكد من إدخال قيم صحيحة');
        return;
      }

      const { error } = await supabase
        .from('merchants')
        .update({
          // delivery_fee محذوف - يُحسب تلقائياً
          min_order_amount: minOrder,
          avg_delivery_time: avgTime,
          description_ar: localDescription || null,
          phone_number: localPhone || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', merchantProfile.id);

      if (error) throw error;

      setMerchantProfile(prev => prev ? {
        ...prev,
        // delivery_fee: deliveryFee,
        min_order_amount: minOrder,
        avg_delivery_time: avgTime,
        description_ar: localDescription || undefined,
        phone_number: localPhone || undefined,
      } : prev);
      setEditing(false);
      Alert.alert('تم', 'تم حفظ التعديلات بنجاح');
      
      // تحديث الموقع تلقائياً إذا لم يكن محدد
      await updateLocationIfNeeded();
    } catch (e) {
      Alert.alert('خطأ', 'تعذر حفظ التعديلات');
    }
  };

  // تحديد الموقع تلقائياً عند أول تحميل للمتجر (إجباري)
  const autoSetLocationOnFirstLoad = async () => {
    if (!merchantProfile) return;
    
    try {
      setUpdatingLocation(true);
      
      // طلب الموقع الحالي تلقائياً
      const currentLocation = await location.getCurrentLocation();
      
      if (currentLocation) {
        // تحديث موقع المتجر في قاعدة البيانات
        const { error } = await supabase
          .from('merchants')
          .update({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            updated_at: new Date().toISOString(),
          })
          .eq('id', merchantProfile.id);
        
        if (error) {
          console.error('Error auto-setting location:', error);
          // عرض تنبيه أن الموقع مطلوب
          Alert.alert(
            '⚠️ تحديد الموقع مطلوب',
            'فشل تحديد موقع المتجر تلقائياً. الرجاء تحديده يدوياً لحساب رسوم التوصيل بدقة.\n\nملاحظة: تحديد الموقع إجباري.',
            [{ text: 'حسناً' }]
          );
        } else {
          // تحديث الحالة المحلية
          setMerchantProfile(prev => prev ? {
            ...prev,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          } : prev);
          
          // لا نعرض تنبيه - تم بصمت
          console.log('✅ تم تحديد موقع المتجر تلقائياً');
        }
      } else {
        // فشل الحصول على الموقع
        Alert.alert(
          '⚠️ تحديد الموقع مطلوب',
          'لم نتمكن من تحديد موقع المتجر تلقائياً.\n\nالرجاء استخدام زر "تحديد موقع المتجر" أدناه.\n\nملاحظة: تحديد الموقع إجباري لحساب رسوم التوصيل.',
          [{ text: 'حسناً' }]
        );
      }
    } catch (error) {
      console.error('Error auto-setting location:', error);
      // عرض تنبيه أن الموقع مطلوب
      Alert.alert(
        '⚠️ تحديد الموقع مطلوب',
        'فشل تحديد موقع المتجر تلقائياً.\n\nالرجاء استخدام زر "تحديد موقع المتجر" أدناه.\n\nملاحظة: تحديد الموقع إجباري.',
        [{ text: 'حسناً' }]
      );
    } finally {
      setUpdatingLocation(false);
    }
  };

  // تحديث موقع المتجر تلقائياً إذا لم يكن محدد
  const updateLocationIfNeeded = async () => {
    if (!merchantProfile) return;
    
    // التحقق إذا كان الموقع محدد بالفعل
    if (merchantProfile.latitude && merchantProfile.longitude) {
      return; // الموقع محدد بالفعل
    }
    
    try {
      setUpdatingLocation(true);
      
      // طلب الموقع الحالي
      const currentLocation = await location.getCurrentLocation();
      
      if (currentLocation) {
        // تحديث موقع المتجر في قاعدة البيانات
        const { error } = await supabase
          .from('merchants')
          .update({
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            updated_at: new Date().toISOString(),
          })
          .eq('id', merchantProfile.id);
        
        if (error) {
          console.error('Error updating merchant location:', error);
        } else {
          // تحديث الحالة المحلية
          setMerchantProfile(prev => prev ? {
            ...prev,
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          } : prev);
          
          Alert.alert(
            'تم تحديث الموقع',
            'تم تحديد موقع متجرك تلقائياً لحساب رسوم التوصيل بدقة.',
            [{ text: 'حسناً' }]
          );
        }
      }
    } catch (error) {
      console.error('Error updating location:', error);
      // لا نعرض تنبيه خطأ هنا لأنه تحديث تلقائي
    } finally {
      setUpdatingLocation(false);
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
    const categoryMap: Record<string, string> = {
      'restaurant': 'مطعم',
      'grocery': 'بقالة',
      'pharmacy': 'صيدلية',
      'gifts': 'هدايا',
      'other': 'أخرى',
      'مطعم': 'مطعم',
      'بقالة': 'بقالة',
      'صيدلية': 'صيدلية',
      'هدايا': 'هدايا',
      'أخرى': 'أخرى',
    };
    return categoryMap[category] || category;
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

  const handleToggleStoreActive = async () => {
    if (!merchantProfile) return;

    const newStatus = !merchantProfile.is_active;
    const action = newStatus ? 'تفعيل' : 'تعطيل';

    Alert.alert(
      `${action} المتجر`,
      `هل أنت متأكد من ${action} هذا المتجر؟\n${!newStatus ? '\n⚠️ عند التعطيل:\n• لن يظهر المتجر للعملاء\n• لن تستطيع إضافة منتجات جديدة\n• الطلبات الحالية ستستمر' : ''}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: action,
          style: newStatus ? 'default' : 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('merchants')
                .update({
                  is_active: newStatus,
                  updated_at: new Date().toISOString()
                })
                .eq('id', merchantProfile.id);

              if (error) throw error;

              setMerchantProfile(prev => prev ? { ...prev, is_active: newStatus } : null);
              Alert.alert('نجاح', `تم ${action} المتجر بنجاح`);
            } catch (error) {
              console.error('Error toggling store active:', error);
              Alert.alert('خطأ', 'حدث خطأ أثناء تحديث حالة المتجر');
            }
          }
        }
      ]
    );
  };

  const handleDeleteStore = async () => {
    if (!merchantProfile) return;

    Alert.alert(
      '⚠️ حذف المتجر نهائياً',
      `هل أنت متأكد من حذف متجر "${merchantProfile.name_ar}"؟\n\n🚨 تحذير:\n• سيتم حذف جميع المنتجات\n• سيتم حذف جميع البيانات\n• لا يمكن التراجع عن هذا الإجراء\n\nاكتب "حذف" للتأكيد:`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائياً',
          style: 'destructive',
          onPress: () => {
            Alert.prompt(
              'تأكيد الحذف',
              'اكتب "حذف" للتأكيد:',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'حذف',
                  style: 'destructive',
                  onPress: async (text?: string) => {
                    if (text === 'حذف') {
                      try {
                        const { error } = await supabase
                          .from('merchants')
                          .delete()
                          .eq('id', merchantProfile.id);

                        if (error) throw error;

                        Alert.alert(
                          'تم الحذف',
                          'تم حذف المتجر بنجاح',
                          [
                            {
                              text: 'حسناً',
                              onPress: () => router.back()
                            }
                          ]
                        );
                      } catch (error) {
                        console.error('Error deleting store:', error);
                        Alert.alert('خطأ', 'حدث خطأ أثناء حذف المتجر');
                      }
                    } else {
                      Alert.alert('خطأ', 'يجب كتابة "حذف" للتأكيد');
                    }
                  }
                }
              ],
              'plain-text'
            );
          }
        }
      ]
    );
  };

  const handleSetStoreLocation = async () => {
    if (!merchantProfile) return;

    Alert.alert(
      'تحديد موقع المتجر',
      'سنستخدم GPS لتحديد موقع متجرك الحالي. هذا سيساعد في حساب رسوم التوصيل تلقائياً.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تحديد الموقع',
          onPress: async () => {
            const userLocation = await location.getCurrentLocation();
            
            if (userLocation) {
              try {
                const { error } = await supabase
                  .from('merchants')
                  .update({
                    latitude: userLocation.latitude,
                    longitude: userLocation.longitude,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', merchantProfile.id);

                if (error) throw error;

                setMerchantProfile(prev => prev ? {
                  ...prev,
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude
                } : null);

                Alert.alert(
                  'تم بنجاح',
                  `تم حفظ موقع المتجر:\n📍 ${userLocation.latitude.toFixed(6)}, ${userLocation.longitude.toFixed(6)}`
                );
              } catch (error) {
                console.error('Error saving location:', error);
                Alert.alert('خطأ', 'حدث خطأ أثناء حفظ الموقع');
              }
            }
          }
        }
      ]
    );
  };

  const pickImage = async (type: 'logo' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 9],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0] && profile?.id && merchantProfile) {
        setUploadingImage(type);
        
        try {
          const imageUrl = await uploadSingleImage(result.assets[0].uri, profile.id);
          
          if (imageUrl) {
            const field = type === 'logo' ? 'logo_url' : 'banner_url';
            const { error } = await supabase
              .from('merchants')
              .update({ [field]: imageUrl })
              .eq('id', merchantProfile.id);

            if (error) throw error;
            
            setMerchantProfile(prev => prev ? { ...prev, [field]: imageUrl } : null);
            Alert.alert('نجاح', `تم تحديث ${type === 'logo' ? 'الشعار' : 'الغلاف'} بنجاح`);
          } else {
            Alert.alert('خطأ', 'فشل رفع الصورة');
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          Alert.alert('خطأ', 'حدث خطأ أثناء رفع الصورة');
        } finally {
          setUploadingImage(null);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء اختيار الصورة');
      setUploadingImage(null);
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
        {stores.length > 1 && <StoreButton />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Merchant Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Store size={30} color={colors.white} />
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
            {editing ? (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <TextInput
                  style={styles.statInput}
                  keyboardType="number-pad"
                  value={localAvgTime}
                  onChangeText={setLocalAvgTime}
                  placeholder="30"
                />
                <Text style={styles.statLabel}>متوسط وقت التوصيل (دقيقة)</Text>
              </View>
            ) : (
              <>
                <Text style={styles.statValue}>{merchantProfile.avg_delivery_time} دقيقة</Text>
                <Text style={styles.statLabel}>متوسط وقت التوصيل</Text>
              </>
            )}
          </View>
          <View style={styles.statCard}>
            {editing ? (
              <View style={{ alignItems: 'center', width: '100%' }}>
                <TextInput
                  style={styles.statInput}
                  keyboardType="decimal-pad"
                  value={localMinOrder}
                  onChangeText={setLocalMinOrder}
                  placeholder="0.00"
                />
                <Text style={styles.statLabel}>الحد الأدنى للطلب</Text>
              </View>
            ) : (
              <>
                <Text style={styles.statValue}>{merchantProfile.min_order_amount.toFixed(2)} {currency}</Text>
                <Text style={styles.statLabel}>الحد الأدنى للطلب</Text>
              </>
            )}
          </View>
        </View>

        {/* Merchant Info */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Store size={20} color={colors.primary} />
            <Text style={styles.sectionTitle}>معلومات المتجر</Text>
            <TouchableOpacity 
              style={styles.editBtn} 
              onPress={() => {
                if (isAllStoresSelected) {
                  Alert.alert(
                    'اختر متجراً',
                    'الرجاء اختيار متجر محدد لتعديل معلوماته',
                    [{ text: 'حسناً' }]
                  );
                } else {
                  router.push(`/merchant/edit-store/${merchantProfile.id}`);
                }
              }}
            >
              <Text style={styles.editBtnText}>تعديل</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>الفئة:</Text>
            <Text style={styles.infoValue}>{getCategoryText(merchantProfile.category)}</Text>
          </View>

          {/* تم حذف حقل رسوم التوصيل - يُحسب تلقائياً بالمسافة */}

          <View style={styles.infoRowColumn}>
            <Text style={styles.infoLabel}>الوصف:</Text>
            {editing ? (
              <TextInput
                style={[styles.inputField, styles.textArea]}
                multiline
                numberOfLines={3}
                value={localDescription}
                onChangeText={setLocalDescription}
                placeholder="وصف المتجر"
              />
            ) : (
              <Text style={styles.infoValue}>{merchantProfile.description_ar || '—'}</Text>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>رقم الهاتف:</Text>
            {editing ? (
              <TextInput
                style={styles.inputField}
                value={localPhone}
                onChangeText={setLocalPhone}
                keyboardType="phone-pad"
                placeholder="مثال: 034333345"
              />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={styles.infoValue}>{merchantProfile.phone_number || '—'}</Text>
                {merchantProfile.phone_number ? (
                  <TouchableOpacity
                    style={{ paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.primary, borderRadius: 8 }}
                    onPress={() => Linking.openURL(`tel:${merchantProfile.phone_number}`)}
                  >
                    <Text style={{ color: colors.white }}>اتصال</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
          </View>
        </View>

        {/* Store Images Section */}
        {!editing && !isAllStoresSelected && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🖼️ صور المتجر</Text>
            </View>
            
            {/* Logo */}
            <View style={styles.imageUploadContainer}>
              <Text style={styles.imageLabel}>شعار المتجر (Logo)</Text>
              <Text style={styles.imageHint}>صورة مربعة تظهر في قائمة المتاجر</Text>
              <TouchableOpacity 
                style={styles.imageUploadButton}
                onPress={() => pickImage('logo')}
                disabled={uploadingImage !== null}
              >
                {merchantProfile.logo_url ? (
                  <Image source={{ uri: merchantProfile.logo_url }} style={styles.logoPreview} />
                ) : (
                  <View style={styles.uploadPlaceholder}>
                    <Text style={styles.uploadPlaceholderText}>⚡ اضغط لرفع الشعار</Text>
                  </View>
                )}
                {uploadingImage === 'logo' && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Banner */}
            <View style={styles.imageUploadContainer}>
              <Text style={styles.imageLabel}>غلاف المتجر (Banner)</Text>
              <Text style={styles.imageHint}>صورة أفقية تظهر في أعلى صفحة المتجر</Text>
              <TouchableOpacity 
                style={styles.imageUploadButton}
                onPress={() => pickImage('banner')}
                disabled={uploadingImage !== null}
              >
                {merchantProfile.banner_url ? (
                  <Image source={{ uri: merchantProfile.banner_url }} style={styles.bannerPreview} />
                ) : (
                  <View style={[styles.uploadPlaceholder, styles.bannerPlaceholder]}>
                    <Text style={styles.uploadPlaceholderText}>⚡ اضغط لرفع الغلاف</Text>
                  </View>
                )}
                {uploadingImage === 'banner' && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator size="large" color={colors.white} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.imageTips}>
              <Text style={styles.tipTitle}>💡 نصائح:</Text>
              <Text style={styles.tipText}>• استخدم صور عالية الجودة</Text>
              <Text style={styles.tipText}>• الصور الجيدة تزيد من جذب العملاء</Text>
              <Text style={styles.tipText}>• اضغط على الصورة لتغييرها</Text>
            </View>
          </View>
        )}

        {/* Store Location */}
        {!editing && !isAllStoresSelected && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin size={20} color={colors.primary} />
              <Text style={styles.sectionTitle}>موقع المتجر (GPS)</Text>
            </View>
            
            {merchantProfile.latitude && merchantProfile.longitude ? (
              <>
                <View style={styles.locationInfo}>
                  <Text style={styles.locationLabel}>📍 الموقع المحفوظ:</Text>
                  <Text style={styles.locationCoords}>
                    {merchantProfile.latitude.toFixed(6)}, {merchantProfile.longitude.toFixed(6)}
                  </Text>
                </View>
                <View style={styles.locationBenefits}>
                  <Text style={styles.benefitTitle}>✅ الفوائد:</Text>
                  <Text style={styles.benefitText}>• حساب تلقائي لرسوم التوصيل</Text>
                  <Text style={styles.benefitText}>• عدالة في التسعير للعملاء</Text>
                  <Text style={styles.benefitText}>• 10 جنيه لكل كيلومتر</Text>
                </View>
              </>
            ) : (
              <View style={styles.locationEmpty}>
                <Text style={[styles.emptyText, { color: colors.error, fontSize: 16 }]}>⚠️ تحديد الموقع مطلوب!</Text>
                <Text style={styles.emptyDescription}>
                  الرجاء تحديد موقع متجرك لحساب رسوم التوصيل تلقائياً.
                  تحديد الموقع إجباري.
                </Text>
              </View>
            )}
            
            {/* إظهار الزر فقط إذا لم يكن الموقع محدد أو أثناء التحديث */}
            {(!merchantProfile.latitude || !merchantProfile.longitude || updatingLocation) && (
              <TouchableOpacity 
                style={[
                  styles.locationButton,
                  (!merchantProfile.latitude || !merchantProfile.longitude) && { backgroundColor: colors.error }
                ]}
                onPress={handleSetStoreLocation}
                disabled={location.loading || updatingLocation}
              >
                {(location.loading || updatingLocation) ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <MapPin size={20} color={colors.white} />
                    <Text style={styles.locationButtonText}>
                      📍 تحديد موقع المتجر (إجباري)
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Merchant Management */}
        {!editing && !isAllStoresSelected && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Store size={20} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.error }]}>إدارة المتجر</Text>
            </View>
            
            <TouchableOpacity 
              style={styles.dangerButton}
              onPress={handleToggleStoreActive}
            >
              <Text style={styles.dangerButtonText}>
                {merchantProfile.is_active ? '🔒 تعطيل المتجر مؤقتاً' : '🔓 تفعيل المتجر'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.dangerButton, { backgroundColor: colors.error }]}
              onPress={handleDeleteStore}
            >
              <Text style={[styles.dangerButtonText, { color: colors.white }]}>
                🗑️ حذف المتجر نهائياً
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* أزرار الحفظ والإلغاء في الأسفل - خارج ScrollView */}
      {editing && (
        <View style={styles.bottomActions}>
          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => {
              setEditing(false);
              if (merchantProfile) {
                // تم إزالة delivery_fee - يُحسب تلقائياً
                setLocalMinOrder(String(merchantProfile.min_order_amount ?? 0));
                setLocalAvgTime(String(merchantProfile.avg_delivery_time ?? 30));
                setLocalDescription(merchantProfile.description_ar || '');
              }
            }}
          >
            <Text style={styles.cancelButtonText}>إلغاء</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.saveButton}
            onPress={handleSaveInfo}
          >
            <Text style={styles.saveButtonText}>حفظ التعديلات</Text>
          </TouchableOpacity>
        </View>
      )}
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
    statInput: {
      ...typography.h3,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      backgroundColor: colors.white,
      textAlign: 'center',
      minHeight: 40,
      width: '80%',
      marginBottom: spacing.xs,
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
    editBtn: {
      marginStart: 'auto',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: borderRadius.sm,
    },
    editBtnText: {
      ...typography.caption,
      color: colors.primary,
    },
    editActions: {
      marginStart: 'auto',
      flexDirection: 'row',
      gap: spacing.sm,
    },
    cancelBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.white,
    },
    cancelText: {
      ...typography.caption,
      color: colors.text,
    },
    saveBtn: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      backgroundColor: colors.primary,
    },
    saveText: {
      ...typography.caption,
      color: colors.white,
    },
    input: {
      flex: 1,
      ...typography.body,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      backgroundColor: colors.white,
    },
    textArea: {
      height: 90,
      textAlignVertical: 'top',
    },
    sectionTitle: {
      ...typography.h3,
      color: colors.text,
      marginRight: spacing.sm,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoRowColumn: {
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    infoLabel: {
      ...typography.body,
      color: colors.text,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    infoValue: {
      ...typography.bodyMedium,
      color: colors.text,
      textAlign: 'left',
      flex: 1,
      marginRight: spacing.md,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: borderRadius.md,
      backgroundColor: colors.white,
      paddingHorizontal: spacing.md,
    },
    inputField: {
      flex: 1,
      ...typography.body,
      color: colors.text,
      paddingVertical: spacing.sm,
      minHeight: 44,
    },
    inputUnit: {
      ...typography.body,
      color: colors.textLight,
      marginLeft: spacing.xs,
    },
    bottomActions: {
      flexDirection: 'row',
      padding: spacing.lg,
      backgroundColor: colors.white,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.md,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.white,
      alignItems: 'center',
    },
    cancelButtonText: {
      ...typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.md,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    saveButtonText: {
      ...typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
    dangerButton: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.error,
      backgroundColor: colors.white,
      alignItems: 'center',
      marginBottom: spacing.sm,
    },
    dangerButtonText: {
      ...typography.bodyMedium,
      color: colors.error,
      fontWeight: '600',
    },
    locationInfo: {
      backgroundColor: colors.background,
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginBottom: spacing.sm,
    },
    locationLabel: {
      ...typography.caption,
      color: colors.textLight,
      marginBottom: spacing.xs,
    },
    locationCoords: {
      ...typography.bodyMedium,
      color: colors.text,
      fontFamily: 'monospace',
    },
    locationBenefits: {
      backgroundColor: colors.success + '10',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.success + '30',
      marginBottom: spacing.md,
    },
    benefitTitle: {
      ...typography.bodyMedium,
      color: colors.success,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    benefitText: {
      ...typography.body,
      color: colors.text,
      marginLeft: spacing.sm,
      lineHeight: 22,
    },
    locationEmpty: {
      backgroundColor: colors.warning + '10',
      padding: spacing.lg,
      borderRadius: borderRadius.md,
      borderWidth: 1,
      borderColor: colors.warning + '30',
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    emptyText: {
      ...typography.bodyMedium,
      color: colors.warning,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    emptyDescription: {
      ...typography.body,
      color: colors.textLight,
      textAlign: 'center',
    },
    locationButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      gap: spacing.sm,
    },
    locationButtonText: {
      ...typography.bodyMedium,
      color: colors.white,
      fontWeight: '600',
    },
    imageUploadContainer: {
      marginBottom: spacing.lg,
    },
    imageLabel: {
      ...typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    imageHint: {
      ...typography.small,
      color: colors.textLight,
      marginBottom: spacing.md,
    },
    imageUploadButton: {
      position: 'relative',
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    logoPreview: {
      width: 150,
      height: 150,
      borderRadius: borderRadius.md,
      alignSelf: 'center',
    },
    bannerPreview: {
      width: '100%',
      height: 200,
      borderRadius: borderRadius.md,
    },
    uploadPlaceholder: {
      width: 150,
      height: 150,
      borderWidth: 2,
      borderColor: colors.border,
      borderStyle: 'dashed',
      borderRadius: borderRadius.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.background,
      alignSelf: 'center',
    },
    bannerPlaceholder: {
      width: '100%',
      height: 200,
    },
    uploadPlaceholderText: {
      ...typography.body,
      color: colors.textLight,
      textAlign: 'center',
    },
    uploadingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageTips: {
      backgroundColor: colors.secondary + '10',
      padding: spacing.md,
      borderRadius: borderRadius.md,
      marginTop: spacing.md,
    },
    tipTitle: {
      ...typography.bodyMedium,
      color: colors.text,
      fontWeight: '600',
      marginBottom: spacing.xs,
    },
    tipText: {
      ...typography.body,
      color: colors.textLight,
      marginLeft: spacing.sm,
      lineHeight: 20,
    },
  });