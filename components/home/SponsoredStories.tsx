import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { setLastAdId } from '@/lib/adAttribution';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Story {
  id: string;
  merchantId: string;
  merchantName: string;
  imageUrl: string;
  badge?: string; // e.g., "NEW", "50%", "📦", "2+1"
  gradientColors: string[];
}

interface SponsoredStoriesProps {
  stories: Story[];
}

export default function SponsoredStories({ stories }: SponsoredStoriesProps) {
  const { user } = useAuth();
  const handleStoryPress = async (story: Story) => {
    try {
      await setLastAdId(story.id);
      await supabase.rpc('record_ad_click', { p_ad_id: story.id, p_user_id: user?.id ?? null });
    } catch {}
    router.push({ pathname: '/merchant/[id]', params: { id: story.merchantId } });
  };

  if (!stories || stories.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>💰 عروض مموّلة</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="عرض جميع العروض المموّلة">
          <Text style={styles.seeAll}>المزيد →</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storiesContainer}
      >
        {stories.map((story) => (
          <TouchableOpacity
            key={story.id}
            style={styles.storyItem}
            onPress={() => handleStoryPress(story)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`عرض إعلان ${story.merchantName}`}
          >
            {/* Gradient Border */}
            <LinearGradient
              colors={story.gradientColors as any}
              style={styles.gradientBorder}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.imageContainer}>
                <Image source={{ uri: story.imageUrl }} style={styles.storyImage} />
                
                {/* Badge Overlay */}
                {story.badge ? (
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badgeText}>{story.badge}</Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>

            {/* Merchant Name */}
            <Text style={styles.merchantName} numberOfLines={1}>
              {story.merchantName}
            </Text>
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
  storiesContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  storyItem: {
    alignItems: 'center',
    width: 80,
  },
  gradientBorder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    padding: 3,
    marginBottom: spacing.xs,
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.white,
    overflow: 'hidden',
    position: 'relative',
  },
  storyImage: {
    width: '100%',
    height: '100%',
  },
  badgeContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  badgeText: {
    ...typography.small,
    color: '#FFD700',
    fontWeight: '700',
    fontSize: 10,
  },
  merchantName: {
    ...typography.caption,
    color: colors.text,
    textAlign: 'center',
  },
});
