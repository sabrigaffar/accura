import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { Star } from 'lucide-react-native';

interface RatingStarsProps {
  rating: number;
  onRatingChange?: (rating: number) => void;
  size?: number;
  readonly?: boolean;
  showLabel?: boolean;
  style?: ViewStyle;
}

export function RatingStars({
  rating,
  onRatingChange,
  size = 32,
  readonly = false,
  showLabel = false,
  style,
}: RatingStarsProps) {
  const [hoveredRating, setHoveredRating] = useState(0);

  const displayRating = hoveredRating || rating;

  const handlePress = (value: number) => {
    if (!readonly && onRatingChange) {
      onRatingChange(value);
    }
  };

  const getRatingText = (value: number) => {
    if (value === 0) return '';
    if (value === 1) return 'سيء جداً';
    if (value === 2) return 'سيء';
    if (value === 3) return 'متوسط';
    if (value === 4) return 'جيد';
    return 'ممتاز';
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((value) => {
          const isFilled = value <= displayRating;
          
          return (
            <TouchableOpacity
              key={value}
              onPress={() => handlePress(value)}
              disabled={readonly}
              style={styles.starButton}
              activeOpacity={0.7}
            >
              <Star
                size={size}
                color={isFilled ? '#FFD700' : '#D1D5DB'}
                fill={isFilled ? '#FFD700' : 'transparent'}
                strokeWidth={2}
              />
            </TouchableOpacity>
          );
        })}
      </View>
      
      {showLabel && displayRating > 0 && (
        <Text style={styles.ratingLabel}>
          {getRatingText(displayRating)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
});
