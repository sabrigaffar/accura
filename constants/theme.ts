// Light Theme Colors
export const lightColors = {
  primary: '#00B074',
  secondary: '#FFD84D',
  background: '#FFFFFF',
  card: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#E0E0E0',
  darkGray: '#757575',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#9E9E9E',
  border: '#E0E0E0',
  error: '#F44336',
  success: '#4CAF50',
  warning: '#FF9800',
  info: '#2196F3',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

// Dark Theme Colors - محسّنة للقراءة
export const darkColors = {
  primary: '#00D68F', // أفتح قليلاً للتباين الأفضل
  secondary: '#FFD84D',
  background: '#0F0F0F', // أغمق قليلاً للتباين الأفضل
  card: '#1A1A1A', // أفتح قليلاً من Background
  lightGray: '#2A2A2A',
  mediumGray: '#404040',
  darkGray: '#B8B8B8', // أفتح للقراءة الأفضل
  text: '#FFFFFF', // أبيض نقي
  textSecondary: '#D0D0D0', // أفتح بكثير للقراءة
  textLight: '#A0A0A0', // أفتح للقراءة
  border: '#2F2F2F', // أخف قليلاً
  error: '#FF6B6B', // أفتح وأوضح
  success: '#51CF66', // أفتح وأوضح
  warning: '#FFB84D', // أفتح وأوضح
  info: '#5B9BD5',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0, 0, 0, 0.75)',
};

// Default colors (for backward compatibility)
export const colors = lightColors;

// Theme type
export type Theme = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const typography = {
  h1: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 32,
    lineHeight: 40,
  },
  h2: {
    fontFamily: 'Cairo_700Bold',
    fontSize: 24,
    lineHeight: 32,
  },
  h3: {
    fontFamily: 'Cairo_600SemiBold',
    fontSize: 20,
    lineHeight: 28,
  },
  body: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 16,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: 'Tajawal_500Medium',
    fontSize: 16,
    lineHeight: 24,
  },
  caption: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 14,
    lineHeight: 20,
  },
  small: {
    fontFamily: 'Tajawal_400Regular',
    fontSize: 12,
    lineHeight: 16,
  },
};

export const shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
};
