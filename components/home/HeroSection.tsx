import React from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, MapPin } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface HeroSectionProps {
  userName?: string;
  location: string;
  searchQuery: string;
  onSearchChange: (text: string) => void;
  onLocationPress?: () => void;
}

export default function HeroSection({
  userName,
  location,
  searchQuery,
  onSearchChange,
  onLocationPress,
}: HeroSectionProps) {
  return (
    <LinearGradient
      colors={['#4A90E2', '#67B5FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Welcome Text */}
      <View style={styles.welcomeContainer}>
        <Text style={styles.greeting}>مرحباً{userName ? `، ${userName}` : ''}! 👋</Text>
        <TouchableOpacity 
          style={styles.locationContainer}
          onPress={onLocationPress}
          activeOpacity={0.7}
        >
          <MapPin size={16} color="#fff" />
          <Text style={styles.locationText} numberOfLines={1}>
            {location}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={20} color={colors.textLight} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="ابحث عن مطعم، منتج..."
          placeholderTextColor={colors.textLight}
          value={searchQuery}
          onChangeText={onSearchChange}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  welcomeContainer: {
    marginBottom: spacing.md,
  },
  greeting: {
    ...typography.h2,
    color: '#fff',
    fontWeight: '700',
    marginBottom: spacing.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  locationText: {
    ...typography.body,
    color: '#fff',
    opacity: 0.9,
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    paddingVertical: spacing.md,
    textAlign: 'right',
  },
});
