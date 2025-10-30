import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Search, UtensilsCrossed, ShoppingCart, Pill, Gift, Grid3x3, Store } from 'lucide-react-native';
import { colors, spacing, borderRadius, typography, shadows } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { Merchant } from '@/types/database';
import { router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';

const CATEGORIES = [
  { id: 'restaurant', name: 'مطاعم', icon: UtensilsCrossed, color: '#FF6B6B' },
  { id: 'grocery', name: 'بقالة', icon: ShoppingCart, color: '#4ECDC4' },
  { id: 'pharmacy', name: 'صيدلية', icon: Pill, color: '#45B7D1' },
  { id: 'gifts', name: 'هدايا', icon: Gift, color: '#FFA07A' },
  { id: 'other', name: 'أخرى', icon: Store, color: '#95A5A6' },
  { id: 'all', name: 'الكل', icon: Grid3x3, color: '#95A5A6' },
];

export default function HomeScreen() {
  const { theme } = useTheme();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const styles = useMemo(() => createStyles(theme), [theme]);

  useEffect(() => {
    fetchMerchants();
  }, [selectedCategory, searchQuery]);

  const fetchMerchants = async () => {
    setLoading(true);
    let query = supabase
      .from('merchants')
      .select('*')
      .eq('is_active', true);

    if (selectedCategory !== 'all') {
      query = query.eq('category', selectedCategory);
    }

    const q = searchQuery.trim();
    if (q) {
      query = query.or(`name_ar.ilike.%${q}%,description_ar.ilike.%${q}%`);
    }

    const { data, error } = await query;

    if (data) {
      setMerchants(data);
    }
    setLoading(false);
  };

  const renderMerchantCard = ({ item }: { item: Merchant }) => (
    <TouchableOpacity
      style={styles.merchantCard}
      onPress={() => router.push({ pathname: '/merchant/[id]', params: { id: item.id } })}
    >
      <View style={styles.merchantImage}>
        {item.logo_url ? (
          <Image source={{ uri: item.logo_url }} style={styles.merchantLogo} />
        ) : (
          <View style={[styles.merchantLogo, styles.placeholderLogo]}>
            <UtensilsCrossed size={32} color={theme.textLight} />
          </View>
        )}
      </View>
      <View style={styles.merchantInfo}>
        <Text style={styles.merchantName} numberOfLines={1}>
          {item.name_ar}
        </Text>
        <View style={styles.merchantMeta}>
          <Text style={styles.rating}>⭐ {item.rating.toFixed(1)}</Text>
          <Text style={styles.metaDivider}>•</Text>
          <Text style={styles.deliveryTime}>{item.avg_delivery_time} دقيقة</Text>
        </View>
        <View style={styles.deliveryFeeContainer}>
          <Text style={styles.deliveryFee}>
            {item.delivery_fee === 0 ? 'توصيل مجاني' : `${item.delivery_fee} جنيه توصيل`}
          </Text>
        </View>
        {!item.is_open && (
          <View style={styles.closedBadge}>
            <Text style={styles.closedText}>مغلق</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.locationBar}>
          <MapPin size={20} color={theme.primary} />
          <View style={styles.locationText}>
            <Text style={styles.locationLabel}>التوصيل إلى</Text>
            <Text style={styles.locationValue}>الرياض، حي النخيل</Text>
          </View>
        </View>

        <View style={styles.searchBarContainer}>
          <View style={styles.searchBar}>
            <Search size={20} color={theme.textLight} />
            <TextInput
              style={styles.searchInput}
              placeholder="ابحث عن مطعم أو منتج..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor={theme.textLight}
            />
          </View>
          <TouchableOpacity style={styles.cartButton}>
            <ShoppingCart size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.bannersContainer}>
          <View style={styles.banner}>
            <Text style={styles.bannerText}>عروض خاصة اليوم 🔥</Text>
            <Text style={styles.bannerSubtext}>خصم حتى 50% على مطاعم مختارة</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>التصنيفات</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
          >
            {CATEGORIES.map((category) => {
              const Icon = category.icon;
              const isSelected = selectedCategory === category.id;
              return (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.categoryCard,
                    isSelected && styles.categoryCardSelected,
                  ]}
                  onPress={() => setSelectedCategory(category.id)}
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: isSelected ? category.color : colors.lightGray },
                    ]}
                  >
                    <Icon size={24} color={isSelected ? colors.white : category.color} />
                  </View>
                  <Text
                    style={[
                      styles.categoryName,
                      isSelected && styles.categoryNameSelected,
                    ]}
                  >
                    {category.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>المطاعم المتاحة</Text>
            <Text style={styles.sectionCount}>({merchants.length})</Text>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>جاري التحميل...</Text>
            </View>
          ) : merchants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>لا توجد مطاعم متاحة حالياً</Text>
            </View>
          ) : (
            <FlatList
              data={merchants}
              renderItem={renderMerchantCard}
              keyExtractor={(item) => item.id}
              numColumns={2}
              columnWrapperStyle={styles.merchantRow}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  locationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  locationText: {
    marginRight: spacing.sm,
  },
  locationLabel: {
    ...typography.small,
    color: theme.textLight,
  },
  locationValue: {
    ...typography.bodyMedium,
    color: theme.text,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.lightGray,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    height: 48,
  },
  cartButton: {
    width: 48,
    height: 48,
    backgroundColor: theme.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: theme.text,
    marginRight: spacing.sm,
    textAlign: 'right',
  },
  content: {
    flex: 1,
  },
  bannersContainer: {
    padding: spacing.md,
  },
  banner: {
    backgroundColor: theme.secondary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.small,
  },
  bannerText: {
    ...typography.h3,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  bannerSubtext: {
    ...typography.body,
    color: theme.text,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.h3,
    color: theme.text,
  },
  sectionCount: {
    ...typography.body,
    color: theme.textLight,
    marginRight: spacing.xs,
  },
  categoriesContainer: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  categoryCard: {
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  categoryCardSelected: {
    transform: [{ scale: 1.05 }],
  },
  categoryIcon: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  categoryName: {
    ...typography.caption,
    color: theme.text,
  },
  categoryNameSelected: {
    ...typography.bodyMedium,
    color: theme.text,
  },
  merchantRow: {
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  merchantCard: {
    width: '48%',
    backgroundColor: theme.surface,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.small,
  },
  merchantImage: {
    width: '100%',
    height: 120,
    backgroundColor: theme.lightGray,
  },
  merchantLogo: {
    width: '100%',
    height: '100%',
  },
  placeholderLogo: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantInfo: {
    padding: spacing.sm,
  },
  merchantName: {
    ...typography.bodyMedium,
    color: theme.text,
    marginBottom: spacing.xs,
  },
  merchantMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  rating: {
    ...typography.small,
    color: theme.text,
  },
  metaDivider: {
    ...typography.small,
    color: theme.textLight,
    marginHorizontal: spacing.xs,
  },
  deliveryTime: {
    ...typography.small,
    color: theme.textLight,
  },
  deliveryFeeContainer: {
    marginTop: spacing.xs,
  },
  deliveryFee: {
    ...typography.caption,
    color: theme.primary,
  },
  closedBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: theme.error + 'DD',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  closedText: {
    ...typography.small,
    color: '#FFFFFF',
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: theme.textLight,
  },
  emptyContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: theme.textLight,
  },
});
