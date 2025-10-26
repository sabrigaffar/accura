import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export function RoleNavigator({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // الاستماع لتغييرات حالة المصادقة فقط
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          router.replace('/auth');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return <>{children}</>;
}
