import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Star, MapPin, Gift, Sparkles } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { setLastAdId } from '@/lib/adAttribution';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface FeaturedStore {
  adId?: string; // optional ad id for attribution if item is sponsored
  id: string;
  name: string;
  imageUrl: string;
  rating: number;
  distance: string;
  discount?: string;
  isSponsored: boolean;
}

interface FeaturedStoresProps {
  stores: FeaturedStore[];
}

export default function FeaturedStores({ stores }: FeaturedStoresProps) {
  const { user } = useAuth();
  const handleStorePress = async (store: FeaturedStore) => {
    try {
      if (store.isSponsored && store.adId) {
        await setLastAdId(store.adId);
        await supabase.rpc('record_ad_click', { p_ad_id: store.adId, p_user_id: user?.id ?? null, p_session_id: null });
      }
    } catch {}
    router.push({ pathname: '/merchant/[id]', params: { id: store.id } });
  };

  if (!stores || stores.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Sparkles size={20} color={colors.primary} />
          <Text style={styles.title}>⭐ مطاعم مميزة</Text>
        </View>
        <TouchableOpacity>
          <Text style={styles.seeAll}>عرض الكل →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storesContainer}
      >
        {stores.map((store) => (
          <TouchableOpacity
            key={store.id}
            style={styles.storeCard}
            onPress={() => handleStorePress(store)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`افتح صفحة ${store.name}`}
          >
            {/* Gradient Border for Sponsored */}
            {store.isSponsored && (
              <LinearGradient
                colors={['#FFD700', '#FF6B6B', '#FFD700']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.gradientBorder}
              />
            )}

            <View style={[styles.cardContent, store.isSponsored && styles.sponsoredCard]}>
              {/* Store Image */}
              <View style={styles.imageContainer}>
                <Image source={{ uri: store.imageUrl }} style={styles.storeImage} />
                
                {/* Sponsored Badge */}
                {store.isSponsored && (
                  <View style={styles.sponsoredBadge}>
                    <Text style={styles.sponsoredText}>💎 مميز</Text>
                  </View>
                )}

                {/* Discount Badge */}
                {store.discount ? (
                  <View style={styles.discountBadge}>
                    <Gift size={12} color="#fff" />
                    <Text style={styles.discountText}>{store.discount}</Text>
                  </View>
                ) : null}
              </View>

              {/* Store Info */}
              <View style={styles.infoContainer}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {store.name}
                </Text>

                <View style={styles.metaRow}>
                  <View style={styles.ratingContainer}>
                    <Star size={12} color="#FFD700" fill="#FFD700" />
                    <Text style={styles.ratingText}>{store.rating}</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.distanceContainer}>
                    <MapPin size={12} color={colors.textLight} />
                    <Text style={styles.distanceText}>{store.distance}</Text>
                  </View>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.h3,
    color: colors.text,
    fontWeight: '700',
  },
  seeAll: {
    ...typography.body,
    color: colors.primary,
    fontWeight: '600',
  },
  storesContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  storeCard: {
    width: 160,
    position: 'relative',
  },
  gradientBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: borderRadius.xl,
    padding: 2,
  },
  cardContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sponsoredCard: {
    margin: 2,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  imageContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
  },
  storeImage: {
    width: '100%',
    height: '100%',
  },
  sponsoredBadge: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  sponsoredText: {
    ...typography.small,
    color: '#FFD700',
    fontWeight: '700',
    fontSize: 10,
  },
  discountBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  discountText: {
    ...typography.small,
    color: '#fff',
    fontWeight: '700',
    fontSize: 10,
  },
  infoContainer: {
    padding: spacing.sm,
  },
  storeName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 12,
    backgroundColor: colors.border,
  },
  distanceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distanceText: {
    ...typography.caption,
    color: colors.textLight,
  },
});
