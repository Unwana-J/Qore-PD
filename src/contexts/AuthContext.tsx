import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Role } from '../types';

interface AuthContextType {
  user: User | null;
  profile: { name: string; role: Role } | null;
  loading: boolean;
  profileLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ name: string; role: Role } | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    // Check active sessions and subscribe to auth changes
    const fetchSession = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (session?.user) {
          setUser(session.user);
          setProfileLoading(true);
          await fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('[Safety] Auth initialization error:', err);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
        setProfileLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setProfileLoading(false);
        // Clear data and redirect on sign out
        import('../lib/safety').then(({ safety }) => safety.clearAllDataAndLogout());
        return;
      }

      if (session?.user) {
        setUser(session.user);
        setProfileLoading(true);
        await fetchProfile(session.user.id);
        setProfileLoading(false);
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string, retryCount = 0): Promise<void> => {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
    );

    try {
      const profilePromise = supabase
        .from('profiles')
        .select('name, role')
        .eq('id', userId)
        .single();
      
      const result = await Promise.race([profilePromise, timeoutPromise]) as any;
      const { data, error } = result;

      if (error) {
        if (retryCount < 2) {
          console.warn(`[Auth] Profile fetch failed (attempt ${retryCount + 1}). Retrying...`, error);
          return fetchProfile(userId, retryCount + 1);
        }
        // After exhausting retries, leave profile null — caller will show login
        console.error('[Auth] Profile fetch failed after all retries. Clearing profile.', error);
        setProfile(null);
      } else if (data) {
        setProfile(data);
      }
    } catch (err) {
      if (retryCount < 2) {
        console.warn(`[Auth] Profile error/timeout (attempt ${retryCount + 1}). Retrying...`);
        return fetchProfile(userId, retryCount + 1);
      }
      // Timeout or error after all retries — do NOT create a dummy profile
      console.error('[Auth] Profile permanently unavailable. Clearing profile state.', err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      setProfileLoading(true);
      await fetchProfile(user.id);
      setProfileLoading(false);
    }
  };

  const signOut = async () => {
    try {
      // Force loading state to prevent UI flickers
      setLoading(true);
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      // Unconditional cleanup
      setUser(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
      
      // Extensive local cleanup via safety utility
      const { safety } = await import('../lib/safety');
      safety.clearAllDataAndLogout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, signOut, refreshProfile }}>
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
