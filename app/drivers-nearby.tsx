import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, Alert } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { ArrowLeft, MapPin, RefreshCw } from 'lucide-react-native';

interface NearbyDriver {
  id: string;
  name: string;
  avatar_url?: string | null;
  distance_km: number;
  is_online: boolean;
}

export default function DriversNearbyScreen() {
  const [drivers, setDrivers] = useState<NearbyDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [radiusKm] = useState(10);
  const [loc, setLoc] = useState<{ lat: number; lng: number } | null>(null);

  const styles = useMemo(() => createStyles(), []);

  const fetchNearby = async () => {
    try {
      setLoading(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('إذن الموقع', 'يرجى السماح للتطبيق بالوصول إلى موقعك لعرض السائقين القريبين');
        setLoading(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setLoc({ lat, lng });

      const { data, error } = await supabase.rpc('drivers_nearby', {
        p_lat: lat,
        p_lng: lng,
        p_radius_km: radiusKm,
      });
      if (error) throw error;
      setDrivers((Array.isArray(data) ? data : []) as NearbyDriver[]);
    } catch (e) {
      console.error('drivers_nearby error:', e);
      Alert.alert('خطأ', 'تعذر جلب السائقين القريبين حالياً');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNearby();
  }, []);

  const renderDriver = ({ item }: { item: NearbyDriver }) => (
    <View style={styles.card}>
      {item.avatar_url ? (
        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]} />
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{item.name || 'سائق'}</Text>
        <View style={styles.row}>
          <MapPin size={14} color={colors.textLight} />
          <Text style={styles.distanceText}>{item.distance_km.toFixed(1)} كم</Text>
        </View>
        <Text style={[styles.status, { color: item.is_online ? '#22c55e' : colors.textLight }]}>
          {item.is_online ? 'متصل' : 'غير متصل'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>سائقون بالقرب منك</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={fetchNearby}>
          <RefreshCw size={18} color={colors.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}> 
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(d) => d.id}
          renderItem={renderDriver}
          contentContainerStyle={drivers.length === 0 ? styles.emptyList : styles.list}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>الخدمة غير متاحة في منطقتك (ضمن {radiusKm} كم)</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    ...typography.h3,
    color: colors.text,
  },
  refreshButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    padding: spacing.md,
  },
  emptyList: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.small,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: spacing.md,
    backgroundColor: colors.lightGray,
  },
  avatarPlaceholder: {
    backgroundColor: colors.lightGray,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  distanceText: {
    ...typography.caption,
    color: colors.textLight,
  },
  status: {
    ...typography.caption,
    marginTop: 4,
  },
  emptyBox: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
  },
});
