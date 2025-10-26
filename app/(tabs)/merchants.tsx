import React, { useState, useEffect } from 'react';
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
import { Search, Filter, UtensilsCrossed } from 'lucide-react-native';

interface Merchant {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  category: string;
  logo_url: string;
  rating: number;
  delivery_fee: number;
  min_order_amount: number;
  is_open: boolean;
}

export default function MerchantsScreen() {
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [filteredMerchants, setFilteredMerchants] = useState<Merchant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    fetchMerchants();
  }, []);

  useEffect(() => {
    filterMerchants();
  }, [merchants, searchQuery, selectedCategory]);

  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('merchants')
        .select('*')
        .eq('is_active', true);

      if (error) throw error;

      setMerchants(data || []);
      setFilteredMerchants(data || []);
    } catch (error) {
      console.error('Error fetching merchants:', error);
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
            <UtensilsCrossed size={32} color={colors.textLight} />
          </View>
        )}
      </View>
      <View style={styles.merchantInfo}>
        <Text style={styles.merchantName}>{item.name_ar}</Text>
        <Text style={styles.merchantDescription} numberOfLines={2}>
          {item.description_ar}
        </Text>
        <View style={styles.merchantDetails}>
          <Text style={styles.rating}>⭐ {item.rating}</Text>
          <Text style={styles.deliveryInfo}>
            {item.delivery_fee > 0 ? `${item.delivery_fee} ريال توصيل` : 'توصيل مجاني'}
          </Text>
        </View>
      </View>
      {item.is_open && <View style={styles.openBadge}><Text style={styles.openText}>مفتوح</Text></View>}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* شريط البحث */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color={colors.textLight} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن متجر..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={colors.textLight}
          />
        </View>
        <TouchableOpacity style={styles.filterButton}>
          <Filter size={20} color={colors.white} />
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
            <Text style={styles.emptyText}>لا توجد متاجر متوفرة</Text>
          </View>
        }
      />
    </View>
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
  searchContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginHorizontal: spacing.xs,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    height: 40,
    textAlign: 'right',
  },
  filterButton: {
    width: 40,
    height: 40,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  categoriesContainer: {
    flexDirection: 'row',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.lightGray,
    marginRight: spacing.sm,
  },
  activeCategory: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    ...typography.caption,
    color: colors.text,
  },
  activeCategoryText: {
    color: colors.white,
  },
  merchantsList: {
    padding: spacing.md,
  },
  merchantCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: colors.black,
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
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  merchantInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  merchantName: {
    ...typography.h3,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  merchantDescription: {
    ...typography.body,
    color: colors.textLight,
    marginBottom: spacing.sm,
    lineHeight: 20,
  },
  merchantDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rating: {
    ...typography.body,
    color: colors.text,
  },
  deliveryInfo: {
    ...typography.caption,
    color: colors.textLight,
  },
  openBadge: {
    backgroundColor: colors.secondary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    margin: spacing.md,
  },
  openText: {
    ...typography.caption,
    color: colors.white,
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
    color: colors.textLight,
  },
});