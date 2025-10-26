import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { colors } from '@/constants/theme';

export default function Index() {
  const [session, setSession] = useState<any>(null);
  const [userType, setUserType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);

      if (session) {
        // جلب نوع المستخدم
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', session.user.id)
          .single();

        if (profile) {
          setUserType(profile.user_type);
        }
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
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

  // العملاء أو القيمة الافتراضية
  return <Redirect href="/(customer-tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});