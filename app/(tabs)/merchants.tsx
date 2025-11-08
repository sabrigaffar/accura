import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';
import { Search, Filter, UtensilsCrossed, Clock, CheckCircle, XCircle, MapPin } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';
import * as Location from 'expo-location';

interface Merchant {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  category: string;
  logo_url: string;
  banner_url?: string;
  rating: number;
  delivery_fee: number;
  min_order_amount: number;
  is_open: boolean;
  working_hours?: any;
  distance_km?: number;
}

export default function MerchantsScreen() {
  const { theme } = useTheme();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const nearbyRadiusKm = 10;

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    fetchMerchants();
  }, []);

  useEffect(() => {
    filterMerchants();
  }, [merchants, searchQuery, selectedCategory]);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      // احصل على موقع العميل ثم اعرض المتاجر القريبة ضمن 10 كم
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setMerchants([]);
        setFilteredMerchants([]);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      const { data, error } = await supabase.rpc('merchants_nearby', {
        p_lat: lat,
        p_lng: lng,
        p_radius_km: nearbyRadiusKm,
      });
      if (error) throw error;
      const rows = Array.isArray(data) ? (data as any[]) : [];
      setMerchants(rows as any);
      setFilteredMerchants(rows as any);
    } catch (error) {
      console.error('Error fetching nearby merchants:', error);
      setMerchants([]);
      setFilteredMerchants([]);
    } finally {
      setLoading(false);
    }
  };

  const filterMerchants = () => {
    let filtered = merchants;

    // تصفية حسب البحث
    if (searchQuery) {
      filtered = filtered.filter(merchant =>
        merchant.name_ar.includes(searchQuery) ||
        merchant.name_en?.includes(searchQuery) ||
        merchant.description_ar.includes(searchQuery)
      );
    }

    // تصفية حسب الفئة
    if (selectedCategory) {
      filtered = filtered.filter(merchant => merchant.category === selectedCategory);
    }

    setFilteredMerchants(filtered);
  };

  

  const getUniqueCategories = () => {
    const categories = merchants.map(merchant => merchant.category);
    return [...new Set(categories)];
  };

  const getWorkingHoursText = (merchant: Merchant) => {
    if (!merchant.working_hours) return 'غير محدد';
    
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = days[new Date().getDay()];
    const todaySchedule = merchant.working_hours[today];
    
    if (!todaySchedule || !todaySchedule.isOpen) {
      return 'مغلق اليوم';
    }
    
    return `${todaySchedule.openTime} - ${todaySchedule.closeTime}`;
  };

  const isMerchantOpenNow = (merchant: Merchant) => {
    return (merchant as any).is_currently_open ?? merchant.is_open;
  };

  const renderMerchantCard = ({ item }: { item: Merchant }) => {
    const isOpen = isMerchantOpenNow(item);
    const workingHours = getWorkingHoursText(item);
    
    return (
      <TouchableOpacity 
        style={styles.merchantCard}
        onPress={() => router.push({ pathname: '/merchant/[id]', params: { id: item.id } })}
      >
        <View style={styles.merchantImage}>
          {(item.banner_url || item.logo_url) ? (
            <Image source={{ uri: (item.banner_url || item.logo_url) as string }} style={styles.merchantLogo} />
          ) : (
            <View style={[styles.merchantLogo, styles.placeholderLogo]}>
              <UtensilsCrossed size={32} color={theme.textLight} />
            </View>
          )}
        </View>
        <View style={styles.merchantInfo}>
          <View style={styles.merchantHeader}>
            <Text style={styles.merchantName}>{item.name_ar}</Text>
            {isOpen ? (
              <View style={styles.statusBadgeOpen}>
                <CheckCircle size={12} color="#fff" />
                <Text style={styles.statusText}>مفتوح</Text>
              </View>
            ) : (
              <View style={styles.statusBadgeClosed}>
                <XCircle size={12} color="#fff" />
                <Text style={styles.statusText}>مغلق</Text>
              </View>
            )}
          </View>
          <Text style={styles.merchantDescription} numberOfLines={2}>
            {item.description_ar}
          </Text>
          <View style={styles.workingHoursRow}>
            <Clock size={14} color={theme.textLight} />
            <Text style={styles.workingHoursText}>{workingHours}</Text>
          </View>
          <View style={styles.merchantDetails}>
            <Text style={styles.rating}>⭐ {item.rating || 0}</Text>
            <Text style={styles.deliveryInfo}>توصيل: {item.delivery_fee} جنيه</Text>
          </View>
          <View style={styles.distanceRow}>
            <MapPin size={14} color={theme.textLight} />
            <Text style={styles.distanceText}>
              {item.distance_km != null ? `${Number(item.distance_km).toFixed(1)} كم` : ''}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* شريط البحث */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color={theme.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن متجر..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={theme.textLight}
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* فلاتر الفئات */}
      <View style={styles.categoriesContainer}>
        <TouchableOpacity
          style={[styles.categoryButton, !selectedCategory && styles.activeCategory]}
          onPress={() => setSelectedCategory(null)}
        >
          <Text style={[styles.categoryText, !selectedCategory && styles.activeCategoryText]}>
            الكل
          </Text>
        </TouchableOpacity>
        {getUniqueCategories().map(category => (
          <TouchableOpacity
            key={category}
            style={[styles.categoryButton, selectedCategory === category && styles.activeCategory]}
            onPress={() => setSelectedCategory(selectedCategory === category ? null : category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.activeCategoryText,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* قائمة التجار */}
      <FlatList
        data={filteredMerchants}
        renderItem={renderMerchantCard}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.merchantsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>لا توجد متاجر قريبة ضمن 10 كم</Text>
          </View>
        }
      />
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.lightGray,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginHorizontal: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: theme.text,
    height: 40,
    textAlign: 'right',
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  
  categoriesContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  categoryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: theme.lightGray,
    marginRight: spacing.sm,
  },
  activeCategory: {
    backgroundColor: theme.primary,
  },
  categoryText: {
    ...typography.caption,
    color: theme.text,
  },
  activeCategoryText: {
    color: '#FFFFFF',
  },
  merchantsList: {
    padding: spacing.md,
  },
  merchantCard: {
    backgroundColor: theme.surface,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  merchantImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.sm,
    margin: spacing.md,
  },
  merchantLogo: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  placeholderLogo: {
    backgroundColor: theme.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  merchantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  merchantName: {
    ...typography.h3,
    color: theme.text,
    flex: 1,
  },
  statusBadgeOpen: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusBadgeClosed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.error || '#dc2626',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    ...typography.caption,
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  merchantDescription: {
    ...typography.body,
    color: theme.textLight,
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  workingHoursRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  workingHoursText: {
    ...typography.caption,
    color: theme.textLight,
  },
  merchantDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rating: {
    ...typography.body,
    color: theme.text,
  },
  deliveryInfo: {
    ...typography.caption,
    color: theme.textLight,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xs,
  },
  distanceText: {
    ...typography.caption,
    color: theme.textLight,
  },
  openBadge: {
    backgroundColor: theme.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    margin: spacing.md,
  },
  openText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: spacing.xxl,
  },
  emptyText: {
    ...typography.body,
    color: theme.textLight,
  },
});