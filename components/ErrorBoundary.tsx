/**
 * Error Boundary Component
 * يلتقط الأخطاء في React Components ويعرض واجهة بديلة
 */

import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary لالتقاط الأخطاء غير المتوقعة
 * 
 * @example
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // تسجيل الخطأ
    console.error('🔴 [ErrorBoundary] Error caught:', error);
    console.error('🔴 [ErrorBoundary] Error info:', errorInfo);

    // استدعاء callback المخصص إن وجد
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    this.setState({
      error,
      errorInfo,
    });

    // يمكن إرسال الخطأ إلى خدمة مراقبة (مثل Sentry)
    // logErrorToService(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // إذا تم تحديد fallback مخصص
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // واجهة الخطأ الافتراضية
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <AlertCircle size={64} color={colors.error} />
          </View>

          <Text style={styles.title}>عذراً، حدث خطأ!</Text>
          <Text style={styles.subtitle}>
            حدث خطأ غير متوقع في التطبيق. يمكنك المحاولة مرة أخرى.
          </Text>

          {__DEV__ && this.state.error && (
            <ScrollView style={styles.errorDetails}>
              <Text style={styles.errorTitle}>تفاصيل الخطأ (وضع التطوير فقط):</Text>
              <Text style={styles.errorMessage}>{this.state.error.toString()}</Text>
              {this.state.errorInfo && (
                <Text style={styles.errorStack}>{this.state.errorInfo.componentStack}</Text>
              )}
            </ScrollView>
          )}

          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <RefreshCw size={20} color={colors.white} />
            <Text style={styles.buttonText}>المحاولة مرة أخرى</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.background,
  },
  iconContainer: {
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.body,
    color: colors.textLight,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    gap: spacing.sm,
  },
  buttonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  errorDetails: {
    maxHeight: 200,
    width: '100%',
    backgroundColor: colors.lightGray,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  errorTitle: {
    ...typography.bodyMedium,
    color: colors.error,
    marginBottom: spacing.sm,
    fontWeight: '600',
  },
  errorMessage: {
    ...typography.caption,
    color: colors.text,
    marginBottom: spacing.md,
    fontFamily: 'monospace',
  },
  errorStack: {
    ...typography.caption,
    color: colors.textLight,
    fontFamily: 'monospace',
    fontSize: 10,
  },
});

export default ErrorBoundary;
