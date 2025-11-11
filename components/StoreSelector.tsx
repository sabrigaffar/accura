import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { Store, ChevronDown, Check, Plus, Grid } from 'lucide-react-native';
import * as Location from 'expo-location';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { useActiveStore } from '@/contexts/ActiveStoreContext';
import { router } from 'expo-router';

interface StoreSelectorProps {
  visible: boolean;
  onClose: () => void;
}

export function StoreSelector({ visible, onClose }: StoreSelectorProps) {
  const { activeStore, stores, setActiveStore, isAllStoresSelected } = useActiveStore();
  const [currentCoords, setCurrentCoords] = React.useState<{ lat: number; lng: number } | null>(null);
  const [distanceByStore, setDistanceByStore] = React.useState<Record<string, number>>({});

  const toRad = (x: number) => (x * Math.PI) / 180;
  const distanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  React.useEffect(() => {
    (async () => {
      if (!visible) return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== Location.PermissionStatus.GRANTED) return;
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCurrentCoords(coords);
        const map: Record<string, number> = {};
        for (const s of stores) {
          const lat = (s as any).latitude != null ? Number((s as any).latitude) : null;
          const lng = (s as any).longitude != null ? Number((s as any).longitude) : null;
          if (lat != null && lng != null) {
            map[s.id] = distanceKm(coords.lat, coords.lng, lat, lng);
          }
        }
        setDistanceByStore(map);
      } catch {}
    })();
  }, [visible, stores]);

  const handleSelectStore = (store: any) => {
    setActiveStore(store);
    onClose();
  };

  const handleSelectAll = () => {
    setActiveStore(null);
    onClose();
  };

  const handleAddStore = () => {
    onClose();
    router.push('/auth/setup-merchant' as any);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Store size={20} color={colors.primary} />
            <Text style={styles.modalTitle}>اختر المتجر</Text>
          </View>

          <ScrollView style={styles.storesList}>
            {/* خيار "الكل" */}
            {stores.length > 1 && (
              <TouchableOpacity
                style={[
                  styles.storeItem,
                  isAllStoresSelected && styles.activeStoreItem,
                ]}
                onPress={handleSelectAll}
              >
                <View style={styles.storeInfo}>
                  <Text style={[
                    styles.storeName,
                    isAllStoresSelected && styles.activeStoreName,
                  ]}>
                    جميع المتاجر
                  </Text>
                  <Text style={styles.storeCategory}>{stores.length} متجر</Text>
                </View>
                {isAllStoresSelected && (
                  <Check size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
            
            {stores.map((store) => (
              <TouchableOpacity
                key={store.id}
                style={[
                  styles.storeItem,
                  activeStore?.id === store.id && styles.activeStoreItem,
                ]}
                onPress={() => handleSelectStore(store)}
              >
                <View style={styles.storeInfo}>
                  <Text style={[
                    styles.storeName,
                    activeStore?.id === store.id && styles.activeStoreName,
                  ]}>
                    {store.name_ar}
                  </Text>
                  <Text style={styles.storeCategory}>
                    {store.category}
                    {distanceByStore[store.id] != null ? ` • ${distanceByStore[store.id].toFixed(1)} كم` : ''}
                  </Text>
                </View>
                {activeStore?.id === store.id && (
                  <Check size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            
            <TouchableOpacity
              style={styles.addStoreButton}
              onPress={handleAddStore}
            >
              <Plus size={20} color={colors.primary} />
              <Text style={styles.addStoreText}>إضافة متجر جديد</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export function StoreButton() {
  const { activeStore, stores, isAllStoresSelected } = useActiveStore();
  const [modalVisible, setModalVisible] = React.useState(false);

  if (stores.length <= 1) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.storeButton}
        onPress={() => setModalVisible(true)}
      >
        {isAllStoresSelected ? (
          <Grid size={16} color={colors.primary} />
        ) : (
          <Store size={16} color={colors.primary} />
        )}
        <Text style={styles.storeButtonText} numberOfLines={1}>
          {isAllStoresSelected ? 'جميع المتاجر' : (activeStore?.name_ar || 'اختر متجر')}
        </Text>
        <ChevronDown size={16} color={colors.primary} />
      </TouchableOpacity>

      <StoreSelector
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  storeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '10',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    gap: spacing.xs,
    maxWidth: 200,
  },
  storeButtonText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  modalTitle: {
    ...typography.h3,
    color: colors.text,
  },
  storesList: {
    maxHeight: 400,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeStoreItem: {
    backgroundColor: colors.primary + '10',
  },
  storeInfo: {
    flex: 1,
  },
  storeName: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  activeStoreName: {
    color: colors.primary,
    fontWeight: '600',
  },
  storeCategory: {
    ...typography.caption,
    color: colors.textLight,
  },
  addStoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
  },
  addStoreText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
});
