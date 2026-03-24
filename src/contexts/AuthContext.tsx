import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Role } from '../types';

interface AuthContextType {
  user: User | null;
  profile: { name: string; role: Role } | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ name: string; role: Role } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    const fetchSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          // Double verify with getUser to ensure token is still valid on server
          const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
          
          if (userError || !verifiedUser) {
            console.warn('[Safety] Session exists but user token is invalid/expired. Clearing.');
            await supabase.auth.signOut();
            setUser(null);
          } else {
            setUser(verifiedUser);
            await fetchProfile(verifiedUser.id);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('[Safety] Auth initialization error:', err);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    // Circuit breaker for production auth hangs (3s limit)
    const authTimeout = setTimeout(() => {
      console.warn('[Safety] Auth check timed out. Force-releasing loading state.');
      setLoading(false);
    }, 3000);

    fetchSession().finally(() => clearTimeout(authTimeout));

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      if (session?.user) {
        setUser(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });


    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        // Fallback or handle missing profile
        setProfile({ name: user?.email?.split('@')[0] || 'User', role: 'PM' });
      } else {
        setProfile(data);
      }
    } catch (err) {
      console.error('Unexpected profile error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setProfile(null);
      import('../lib/safety').then(({ safety }) => safety.clearAllDataAndLogout());
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
