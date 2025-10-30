import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '@/constants/theme';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { session, userType, loading } = useAuth();

  // عرض شاشة تحميل أثناء تحديد الجلسة ونوع المستخدم
  if (loading || (session && !userType)) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // إذا لم يكن هناك session، وجه لصفحة تسجيل الدخول
  if (!session) {
    return <Redirect href="/auth" />;
  }

  // توجيه حسب نوع المستخدم
  if (userType === 'merchant') {
    return <Redirect href="/(merchant-tabs)" />;
  }

  if (userType === 'driver') {
    return <Redirect href="/(driver-tabs)" />;
  }

  // العملاء فقط
  if (userType === 'customer') {
    return <Redirect href="/(customer-tabs)" />;
  }

  // في حالة userType غير معروف، عرض تحميل
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});