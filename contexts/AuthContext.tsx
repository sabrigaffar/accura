import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Session, User } from '@supabase/supabase-js';
import { Profile, UserType } from '@/types/database';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  userType: UserType | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateUserType: (newUserType: 'customer' | 'merchant' | 'driver' | 'admin') => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  userType: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  updateUserType: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      setProfile(data);
      return;
    }

    const defaults: any = {
      id: userId,
      full_name: user?.user_metadata?.full_name ?? null,
      phone_number: user?.user_metadata?.phone_number ?? null,
      language: 'ar',
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: created } = await supabase
      .from('profiles')
      .insert(defaults)
      .select('*')
      .single();

    if (created) {
      setProfile(created);
    }
  };

  // دالة لتحديث نوع المستخدم
  const updateUserType = async (newUserType: 'customer' | 'merchant' | 'driver' | 'admin') => {
    if (!user?.id) {
      return { error: new Error('No user ID available') };
    }
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        user_type: newUserType,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
      
    if (!error) {
      // تحديث الحالة المحلية
      setProfile(prev => prev ? { ...prev, user_type: newUserType } : null);
    }
    
    return { error };
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const logoutOnNext = await AsyncStorage.getItem('logout_on_next_launch');
      if (logoutOnNext === 'true') {
        await AsyncStorage.setItem('logout_on_next_launch', 'false');
        if (session) {
          await supabase.auth.signOut();
        }
        setLoading(false);
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
        }
        setLoading(false);
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    await AsyncStorage.setItem('logout_on_next_launch', 'false');
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        userType: profile?.user_type ?? null,
        loading,
        signOut,
        refreshProfile,
        updateUserType,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
