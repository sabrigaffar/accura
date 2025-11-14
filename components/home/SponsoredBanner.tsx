import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, ScrollView } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Star, Clock, MapPin, Gift } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BANNER_WIDTH = SCREEN_WIDTH - (spacing.lg * 2);
// Responsive height: between 200 and 260 depending on device width
const BANNER_HEIGHT = Math.max(200, Math.min(260, SCREEN_WIDTH * 0.52));
const isSmallScreen = SCREEN_WIDTH < 380;
const MAX_DESC_LINES = isSmallScreen ? 2 : 3;

interface SponsoredAd {
  id: string;
  merchantId: string;
  merchantName: string;
  imageUrl: string;
  title: string;
  description: string;
  discount?: string;
  rating?: number;
  distance?: string;
  deliveryFee?: number;
}

interface SponsoredBannerProps {
  ads: SponsoredAd[];
  onImpression?: (adId: string) => void;
  onClick?: (adId: string) => void;
}

export default function SponsoredBanner({ ads, onImpression, onClick }: SponsoredBannerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [viewedAds, setViewedAds] = useState<Set<string>>(new Set());

  // Record impression for first ad on mount
  useEffect(() => {
    if (ads.length > 0 && !viewedAds.has(ads[0].id)) {
      setViewedAds(new Set([ads[0].id]));
      onImpression?.(ads[0].id);
    }
  }, [ads]);

  // Auto-scroll every 5 seconds
  useEffect(() => {
    if (ads.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % ads.length;
        scrollViewRef.current?.scrollTo({
          x: nextIndex * SCREEN_WIDTH,
          animated: true,
        });
        return nextIndex;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [ads.length]);

  const handleScroll = (event: any) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffset / SCREEN_WIDTH);
    setCurrentIndex(index);
    
    // Record impression for newly visible ad
    if (index < ads.length && !viewedAds.has(ads[index].id)) {
      setViewedAds(prev => new Set([...prev, ads[index].id]));
      onImpression?.(ads[index].id);
    }
  };

  const handleAdPress = (ad: SponsoredAd) => {
    onClick?.(ad.id);
    router.push({ pathname: '/merchant/[id]', params: { id: ad.merchantId } });
  };

  if (!ads || ads.length === 0) return null;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {ads.map((ad) => (
          <TouchableOpacity
            key={ad.id}
            style={styles.bannerCard}
            onPress={() => handleAdPress(ad)}
            activeOpacity={0.9}
            accessibilityRole="button"
            accessibilityLabel={`إعلان مموّل من ${ad.merchantName}. ${ad.title || ''}`}
          >
            {/* Image + Overlay wrapper to enforce rounded corners and clipping */}
            <View style={styles.imageWrapper}>
              {/* Background Image */}
              <ExpoImage
                source={{ uri: ad.imageUrl }}
                style={styles.backgroundImage}
                contentFit="cover"
                transition={250}
                cachePolicy="memory-disk"
              />
              
              {/* Gradient Overlay */}
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={[styles.gradientOverlay, isSmallScreen && styles.gradientOverlaySmall]}
              >
              {/* Sponsored Badge */}
              <View style={styles.sponsoredBadge}>
                <Text style={styles.sponsoredText}>⭐ إعلان مموّل</Text>
              </View>

              {/* Content */}
              <View style={styles.content}>
                <Text style={styles.merchantName} numberOfLines={1} ellipsizeMode="tail">{ad.merchantName}</Text>
                
                {ad.discount ? (
                  <View style={styles.discountBanner}>
                    <Gift size={18} color="#fff" />
                    <Text style={styles.discountText} numberOfLines={1} ellipsizeMode="tail">{ad.discount}</Text>
                  </View>
                ) : null}

                <Text style={styles.description} numberOfLines={MAX_DESC_LINES} ellipsizeMode="tail">{ad.description}</Text>

                {/* Meta Info */}
                <View style={styles.metaRow}>
                  {!isSmallScreen && typeof ad.rating === 'number' && ad.rating > 0 ? (
                    <View style={styles.metaItem}>
                      <Star size={14} color="#FFD700" fill="#FFD700" />
                      <Text style={styles.metaText}>{ad.rating}</Text>
                    </View>
                  ) : null}
                  {!isSmallScreen && ad.distance ? (
                    <View style={styles.metaItem}>
                      <MapPin size={14} color="#fff" />
                      <Text style={styles.metaText}>{ad.distance}</Text>
                    </View>
                  ) : null}
                  {ad.deliveryFee !== undefined && (
                    <View style={styles.metaItem}>
                      <Text style={styles.metaText}>
                        {ad.deliveryFee === 0 ? 'توصيل مجاني' : `توصيل: ${ad.deliveryFee} ج`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* CTA Button */}
                <TouchableOpacity
                  style={styles.ctaButton}
                  accessibilityRole="button"
                  accessibilityLabel={`افتح صفحة ${ad.merchantName} لبدء الطلب`}
                >
                  <Text style={styles.ctaText}>اطلب الآن →</Text>
                </TouchableOpacity>
              </View>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Dots Indicator */}
      {ads.length > 1 && (
        <View style={styles.dotsContainer}>
          {ads.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                index === currentIndex && styles.activeDot,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: spacing.md,
  },
  bannerCard: {
    width: SCREEN_WIDTH,
    // Let content define height via aspectRatio to avoid clipping on small screens
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  imageWrapper: {
    width: BANNER_WIDTH,
    aspectRatio: isSmallScreen ? 4 / 3 : 16 / 9,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  backgroundImage: {
    position: 'absolute',
    width: BANNER_WIDTH,
    height: '100%',
    borderRadius: borderRadius.xl,
  },
  gradientOverlay: {
    width: BANNER_WIDTH,
    height: '100%',
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  // Reduced padding overlay for small screens
  gradientOverlaySmall: {
    padding: spacing.md,
  },
  sponsoredBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
    zIndex: 2,
  },
  sponsoredText: {
    ...typography.caption,
    color: '#FFD700',
    fontWeight: '600',
  },
  content: {
    gap: Math.max(2, spacing.xs - 2),
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  merchantName: {
    ...typography.h2,
    color: '#fff',
    fontWeight: '700',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    fontSize: isSmallScreen ? 20 : 24,
  },
  discountBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#FF6B6B',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.lg,
    maxWidth: Math.floor(BANNER_WIDTH * 0.8),
  },
  discountText: {
    ...typography.bodyMedium,
    color: '#fff',
    fontWeight: '700',
    fontSize: isSmallScreen ? 12 : 14,
  },
  description: {
    ...typography.body,
    color: '#fff',
    opacity: 0.9,
    fontSize: isSmallScreen ? 12 : 13,
    lineHeight: isSmallScreen ? 18 : 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: '500',
    fontSize: isSmallScreen ? 11 : 12,
  },
  ctaButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
  },
  ctaText: {
    ...typography.bodyMedium,
    color: '#fff',
    fontWeight: '700',
    fontSize: isSmallScreen ? 13 : 14,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  activeDot: {
    width: 20,
    backgroundColor: colors.primary,
  },
});
