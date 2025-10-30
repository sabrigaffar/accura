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
import { MapPin, Plus, Edit3, Trash2 } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from '@/hooks/useLocation';
import { ActivityIndicator } from 'react-native';

interface Address {
  id: string;
  title: string;
  street_address: string;
  city: string;
  district?: string;
  building_number?: string;
  floor_number?: string;
  latitude?: number;
  longitude?: number;
}

export default function AddressesScreen() {
  const { user, profile } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [title, setTitle] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [buildingNumber, setBuildingNumber] = useState('');
  const [floorNumber, setFloorNumber] = useState('');
  const location = useLocation();
  const [currentLatitude, setCurrentLatitude] = useState<number | null>(null);
  const [currentLongitude, setCurrentLongitude] = useState<number | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user]);

  // تحديد الموقع تلقائياً عند فتح الـ Modal
  useEffect(() => {
    if (showModal && !editingAddress) {
      // عند إضافة عنوان جديد - حاول تحديد الموقع تلقائياً
      autoDetectLocation();
    }
  }, [showModal]);

  const autoDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const currentLocation = await location.getCurrentLocation();
      if (currentLocation) {
        setCurrentLatitude(currentLocation.latitude);
        setCurrentLongitude(currentLocation.longitude);
      } else {
        Alert.alert(
          '⚠️ تحديد الموقع مطلوب',
          'لم نتمكن من تحديد موقعك تلقائياً. الرجاء الضغط على زر "تحديد موقعي" لحساب رسوم التوصيل بدقة.\n\nملاحظة: تحديد الموقع إجباري.',
          [{ text: 'حسناً' }]
        );
      }
    } catch (error) {
      console.error('Error auto-detecting location:', error);
    } finally {
      setDetectingLocation(false);
    }
  };

  const manualDetectLocation = async () => {
    setDetectingLocation(true);
    try {
      const currentLocation = await location.getCurrentLocation();
      if (currentLocation) {
        setCurrentLatitude(currentLocation.latitude);
        setCurrentLongitude(currentLocation.longitude);
        Alert.alert(
          '✅ تم تحديد الموقع',
          `تم تحديد موقعك بنجاح!\n\nخط العرض: ${currentLocation.latitude.toFixed(6)}\nخط الطول: ${currentLocation.longitude.toFixed(6)}`,
          [{ text: 'ممتاز!' }]
        );
      } else {
        Alert.alert(
          'خطأ',
          'لم نتمكن من تحديد موقعك. تأكد من:\n• تفعيل خدمات الموقع\n• السماح للتطبيق بالوصول للموقع',
          [{ text: 'حسناً' }]
        );
      }
    } catch (error) {
      console.error('Error detecting location:', error);
      Alert.alert('خطأ', 'فشل في تحديد الموقع');
    } finally {
      setDetectingLocation(false);
    }
  };

  const addAddress = async () => {
    if (!user) return;
    if (!title.trim() || !street.trim() || !city.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال العنوان، الشارع، والمدينة');
      return;
    }

    // التحقق من تحديد الموقع
    if (!currentLatitude || !currentLongitude) {
      Alert.alert(
        '⚠️ تحديد الموقع مطلوب',
        'الرجاء تحديد موقعك أولاً لحساب رسوم التوصيل بدقة.\n\nاضغط على زر "تحديد موقعي" أدناه.',
        [{ text: 'حسناً' }]
      );
      return;
    }

    try {
      const { data, error } = await supabase
        .from('addresses')
        .insert({
          user_id: user.id,
          title: title.trim(),
          street_address: street.trim(),
          city: city.trim(),
          district: district.trim() || null,
          building_number: buildingNumber.trim() || null,
          floor_number: floorNumber.trim() || null,
          latitude: currentLatitude,
          longitude: currentLongitude,
          is_default: addresses.length === 0,
        })
        .select('*')
        .single();

      if (error) throw error;

      setAddresses(prev => [data as Address, ...prev]);
      
      // مزامنة عنوان المتجر إذا كان المستخدم تاجرًا
      if (profile?.user_type === 'merchant') {
        try {
          const parts = [city.trim(), district.trim(), street.trim()].filter(Boolean).join(', ');
          const formatted = buildingNumber.trim() ? `${parts}, عمارة ${buildingNumber.trim()}` : parts;
          await supabase
            .from('merchants')
            .update({ address: formatted, updated_at: new Date().toISOString() })
            .eq('owner_id', user.id);
        } catch {}
      }

      closeModal();
      Alert.alert('نجاح', 'تم إضافة العنوان بنجاح');
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء إضافة العنوان');
    }
  };

  const updateAddress = async () => {
    if (!user || !editingAddress) return;
    if (!title.trim() || !street.trim() || !city.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال العنوان، الشارع، والمدينة');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('addresses')
        .update({
          title: title.trim(),
          street_address: street.trim(),
          city: city.trim(),
          district: district.trim() || null,
          building_number: buildingNumber.trim() || null,
          floor_number: floorNumber.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingAddress.id)
        .select('*')
        .single();

      if (error) throw error;

      setAddresses(prev => prev.map(addr => 
        addr.id === editingAddress.id ? data as Address : addr
      ));
      
      // مزامنة عنوان المتجر إذا كان المستخدم تاجرًا
      if (profile?.user_type === 'merchant') {
        try {
          const parts = [city.trim(), district.trim(), street.trim()].filter(Boolean).join(', ');
          const formatted = buildingNumber.trim() ? `${parts}, عمارة ${buildingNumber.trim()}` : parts;
          await supabase
            .from('merchants')
            .update({ address: formatted, updated_at: new Date().toISOString() })
            .eq('owner_id', user.id);
        } catch {}
      }

      closeModal();
      Alert.alert('نجاح', 'تم تحديث العنوان بنجاح');
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء تحديث العنوان');
    }
  };

  const openAddModal = () => {
    setEditingAddress(null);
    setTitle('');
    setStreet('');
    setCity('');
    setDistrict('');
    setBuildingNumber('');
    setFloorNumber('');
    setShowModal(true);
  };

  const openEditModal = (address: Address) => {
    setEditingAddress(address);
    setTitle(address.title);
    setStreet(address.street_address);
    setCity(address.city);
    setDistrict(address.district || '');
    setBuildingNumber(address.building_number || '');
    setFloorNumber(address.floor_number || '');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingAddress(null);
    setTitle('');
    setStreet('');
    setCity('');
    setDistrict('');
    setBuildingNumber('');
    setFloorNumber('');
  };

  const fetchAddresses = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;

      setAddresses(data || []);
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'حدث خطأ أثناء جلب العناوين');
    } finally {
      setLoading(false);
    }
  };

  const deleteAddress = async (addressId: string) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من حذف هذا العنوان؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('addresses')
                .delete()
                .eq('id', addressId);

              if (error) throw error;

              // تحديث قائمة العناوين
              setAddresses(addresses.filter(addr => addr.id !== addressId));
              Alert.alert('نجاح', 'تم حذف العنوان بنجاح');
            } catch (error: any) {
              Alert.alert('خطأ', error.message || 'حدث خطأ أثناء حذف العنوان');
            }
          },
        },
      ]
    );
  };

  const renderAddressCard = ({ item }: { item: Address }) => (
    <View style={styles.addressCard}>
      <View style={styles.addressHeader}>
        <View style={styles.addressTitleContainer}>
          <MapPin size={20} color={colors.primary} />
          <Text style={styles.addressTitle}>{item.title}</Text>
        </View>
        <View style={styles.addressActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => openEditModal(item)}
          >
            <Edit3 size={16} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => deleteAddress(item.id)}
          >
            <Trash2 size={16} color={colors.error} />
          </TouchableOpacity>
        </View>
      </View>
      
      <View style={styles.addressDetails}>
        <Text style={styles.addressText}>{item.street_address}</Text>
        <Text style={styles.addressText}>{item.city}</Text>
        {item.district && <Text style={styles.addressText}>{item.district}</Text>}
        {(item.building_number || item.floor_number) && (
          <Text style={styles.addressText}>
            {item.building_number ? `عمارة ${item.building_number}` : ''}
            {item.floor_number ? `, طابق ${item.floor_number}` : ''}
          </Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>عناويني</Text>
      </View>

      <ScrollView style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>جاري التحميل...</Text>
          </View>
        ) : addresses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MapPin size={64} color={colors.textLight} />
            <Text style={styles.emptyTitle}>لا توجد عناوين</Text>
            <Text style={styles.emptyText}>قم بإضافة عنوان جديد لبدء الطلب</Text>
          </View>
        ) : (
          <View style={styles.addressesList}>
            {addresses.map((address) => (
              <React.Fragment key={address.id}>
                {renderAddressCard({ item: address })}
              </React.Fragment>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity 
        style={styles.addButton}
        onPress={openAddModal}
      >
        <Plus size={24} color={colors.white} />
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingAddress ? 'تعديل العنوان' : 'إضافة عنوان جديد'}
            </Text>
            
            <ScrollView style={styles.formScroll}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>العنوان</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="المنزل / العمل" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>الشارع</Text>
                <TextInput style={styles.input} value={street} onChangeText={setStreet} placeholder="اسم الشارع" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>المدينة</Text>
                <TextInput style={styles.input} value={city} onChangeText={setCity} placeholder="المدينة" />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>الحي (اختياري)</Text>
                <TextInput style={styles.input} value={district} onChangeText={setDistrict} placeholder="الحي" />
              </View>
              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1 }]}> 
                  <Text style={styles.label}>رقم العمارة</Text>
                  <TextInput style={styles.input} value={buildingNumber} onChangeText={setBuildingNumber} placeholder="مثال: 12" />
                </View>
                <View style={{ width: spacing.md }} />
                <View style={[styles.inputGroup, { flex: 1 }]}> 
                  <Text style={styles.label}>رقم الطابق</Text>
                  <TextInput style={styles.input} value={floorNumber} onChangeText={setFloorNumber} placeholder="مثال: 3" />
                </View>
              </View>
            </ScrollView>

            {/* زر تحديد الموقع */}
            <View style={styles.locationSection}>
              <TouchableOpacity
                style={[
                  styles.locationButton,
                  (currentLatitude && currentLongitude) ? styles.locationButtonSuccess : null,
                  detectingLocation ? styles.locationButtonDisabled : null
                ]}
                onPress={manualDetectLocation}
                disabled={detectingLocation}
              >
                {detectingLocation ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <MapPin size={20} color={colors.white} />
                    <Text style={styles.locationButtonText}>
                      {currentLatitude && currentLongitude ? '✅ تم تحديد الموقع' : '📍 تحديد موقعي (إجباري)'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              {currentLatitude && currentLongitude && (
                <Text style={styles.locationHint}>
                  📍 تم تحديد موقعك بنجاح
                </Text>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={closeModal}
              >
                <Text style={styles.cancelButtonText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={editingAddress ? updateAddress : addAddress}
              >
                <Text style={styles.confirmButtonText}>
                  {editingAddress ? 'تحديث' : 'إضافة'}
                </Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  loadingText: {
    ...typography.body,
    color: colors.textLight,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
  addressesList: {
    padding: spacing.md,
  },
  addressCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  addressTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addressTitle: {
    ...typography.h3,
    color: colors.text,
    marginRight: spacing.sm,
  },
  addressActions: {
    flexDirection: 'row',
  },
  actionButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  addressDetails: {
    borderRightWidth: 2,
    borderRightColor: colors.primary,
    paddingRight: spacing.md,
  },
  addressText: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  addButton: {
    position: 'absolute',
    bottom: spacing.xl,
    left: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.medium,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '100%',
    maxHeight: '80%',
  },
  modalTitle: {
    ...typography.h2,
    color: colors.text,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  formScroll: {
    maxHeight: 400,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.lightGray,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.text,
    fontWeight: '600',
  },
  confirmButtonText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.lightGray,
  },
  row: {
    flexDirection: 'row',
  },
  label: {
    ...typography.body,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  locationSection: {
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    ...shadows.small,
  },
  locationButtonSuccess: {
    backgroundColor: colors.success,
  },
  locationButtonDisabled: {
    opacity: 0.6,
  },
  locationButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  locationHint: {
    ...typography.caption,
    color: colors.success,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
});