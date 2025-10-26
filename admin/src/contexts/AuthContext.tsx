import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

// Types
interface User {
  id: string;
  email: string;
  full_name: string;
  user_type: 'admin' | 'customer' | 'merchant' | 'driver';
}

interface AuthContextType {
  user: User | null;
  session: any;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Check active session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        
        if (session?.user) {
          // Fetch user profile
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            console.error('Error fetching profile:', error);
            return;
          }
          
          // Check if user is admin
          if (profile.user_type === 'admin') {
            setUser({
              id: profile.id,
              email: session.user.email || '',
              full_name: profile.full_name,
              user_type: profile.user_type
            });
          } else {
            // If not admin, sign out
            await supabase.auth.signOut();
          }
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
      if (session?.user) {
        // Fetch user profile
        supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data: profile, error }) => {
            if (error) {
              console.error('Error fetching profile:', error);
              return;
            }
            
            // Check if user is admin
            if (profile?.user_type === 'admin') {
              setUser({
                id: profile.id,
                email: session.user.email || '',
                full_name: profile.full_name,
                user_type: profile.user_type
              });
            } else {
              // If not admin, sign out
              supabase.auth.signOut();
            }
          });
      } else {
        setUser(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Sign in function
  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { error };
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        return { error: profileError };
      }

      // Check if user is admin
      if (profile.user_type !== 'admin') {
        // Sign out if not admin
        await supabase.auth.signOut();
        return { error: new Error('Access denied. Admin privileges required.') };
      }

      setUser({
        id: profile.id,
        email: data.user.email || '',
        full_name: profile.full_name,
        user_type: profile.user_type
      });

      return { error: null };
    } catch (error: any) {
      return { error };
    }
  };

  // Sign out function
  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  // Refresh user function
  const refreshUser = async () => {
    if (session?.user) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (!error && profile) {
        setUser({
          id: profile.id,
          email: session.user.email || '',
          full_name: profile.full_name,
          user_type: profile.user_type
        });
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signOut,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};