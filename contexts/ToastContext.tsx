import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, TouchableOpacity } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@/constants/theme';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastOptions {
  duration?: number; // ms
}

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  show: (message: string, type?: ToastType, options?: ToastOptions) => void;
  success: (message: string, options?: ToastOptions) => void;
  error: (message: string, options?: ToastOptions) => void;
  info: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const animatedValues = useRef<Record<number, Animated.Value>>({}).current;

  const remove = useCallback((id: number) => {
    const anim = animatedValues[id];
    if (anim) {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        delete animatedValues[id];
      });
    } else {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete animatedValues[id];
    }
  }, [animatedValues]);

  const show = useCallback((message: string, type: ToastType = 'info', options?: ToastOptions) => {
    const id = idRef.current++;
    const duration = options?.duration ?? 3000;
    const anim = new Animated.Value(0);
    animatedValues[id] = anim;

    setToasts((prev) => [...prev, { id, type, message }]);

    Animated.timing(anim, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => remove(id), duration);
    });
  }, [remove, animatedValues]);

  const success = useCallback((message: string, options?: ToastOptions) => show(message, 'success', options), [show]);
  const error = useCallback((message: string, options?: ToastOptions) => show(message, 'error', options), [show]);
  const info = useCallback((message: string, options?: ToastOptions) => show(message, 'info', options), [show]);

  const value = useMemo(() => ({ show, success, error, info }), [show, success, error, info]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Overlay */}
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <View style={styles.container} pointerEvents="box-none">
          {toasts.map((t) => {
            const anim = animatedValues[t.id] || new Animated.Value(1);
            const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] });
            const opacity = anim;
            return (
              <Animated.View key={t.id} style={[styles.toast, styles[t.type], { opacity, transform: [{ translateY }] }]}> 
                <Text style={styles.message} accessibilityRole="alert" accessibilityLabel={t.message}>
                  {t.message}
                </Text>
                <TouchableOpacity onPress={() => remove(t.id)} accessibilityLabel="إغلاق التنبيه" style={styles.close}>
                  <Text style={styles.closeText}>×</Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    right: spacing.lg,
    gap: spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  success: { backgroundColor: '#0f9d58' },
  error: { backgroundColor: '#d93025' },
  info: { backgroundColor: '#4285f4' },
  message: {
    ...typography.body,
    color: colors.white,
    flex: 1,
  },
  close: {
    marginLeft: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  closeText: { color: '#fff', fontSize: 18, lineHeight: 18 },
});
