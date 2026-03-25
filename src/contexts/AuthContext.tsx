import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Role } from '../types';

interface AuthContextType {
  user: User | null;
  profile: { name: string; role: Role } | null;
  loading: boolean;
  profileLoading: boolean;
  isReconnecting: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ name: string; role: Role } | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  /**
   * Fetch the user profile from the DB.
   * Token refresh is handled automatically by the Supabase client via
   * onAuthStateChange(TOKEN_REFRESHED) — we do NOT call getSession() here
   * to avoid IndexedDB lock contention when multiple tabs are open.
   */
  const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<void> => {

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 15000)
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
          console.warn(`[Auth] Profile fetch error (attempt ${retryCount + 1}):`, error.message);
          await new Promise(r => setTimeout(r, 1500 * (retryCount + 1)));
          return fetchProfile(userId, retryCount + 1);
        }
        console.error('[Auth] Profile fetch permanently failed after retries.', error);
        setProfile(null);
      } else if (data) {
        console.log('[Auth] Profile fetched successfully.');
        setProfile({ name: data.name, role: data.role as Role });
      } else {
        // No row found for this ID
        console.error('[Auth] User exists but NO PROFILE ROW was found in public.profiles. Trigger may have failed.');
        setProfile(null);
      }
    } catch (err) {
      if (retryCount < 2) {
        console.warn(`[Auth] Profile timeout (attempt ${retryCount + 1}). Retrying...`);
        await new Promise(r => setTimeout(r, 1500 * (retryCount + 1)));
        return fetchProfile(userId, retryCount + 1);
      }
      console.error('[Auth] Profile fetch timed out after all retries.', err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
      setIsReconnecting(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log('[Auth] Starting initialization...');
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (!mounted) return;
        if (sessionError) throw sessionError;

        if (session?.user) {
          console.log('[Auth] Initial session found for user:', session.user.id);
          setUser(session.user);
          setProfileLoading(true);
          await fetchProfile(session.user.id);
        } else {
          console.log('[Auth] No initial session found.');
          setUser(null);
          setProfile(null);
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        setUser(null);
        setProfile(null);
      } finally {
        if (mounted) {
          console.log('[Auth] Initialization complete. Setting loading=false.');
          setLoading(false);
          setProfileLoading(false);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      console.log('[Auth] Auth state changed:', event, session?.user?.id || 'no user');

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setProfileLoading(false);
        setIsReconnecting(false);
        import('../lib/safety').then(({ safety }) => safety.clearAllDataAndLogout());
        return;
      }

      // TOKEN_REFRESHED fires after idle — silently re-sync the profile
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('[Auth] Token refreshed — re-syncing profile silently.');
        setIsReconnecting(true);
        setUser(session.user);
        await fetchProfile(session.user.id);
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        console.log('[Auth] User signed in/updated. Syncing profile...');
        setUser(session.user);
        setProfileLoading(true);
        await fetchProfile(session.user.id);
        setProfileLoading(false);
        setLoading(false); // Ensure loading is false after sign-in sync
      } else if (!session) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const refreshProfile = async () => {
    if (user?.id) {
      setProfileLoading(true);
      await fetchProfile(user.id);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } catch (e) {
      console.error('Logout error:', e);
    } finally {
      setUser(null);
      setProfile(null);
      setLoading(false);
      setProfileLoading(false);
      setIsReconnecting(false);
      const { safety } = await import('../lib/safety');
      safety.clearAllDataAndLogout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, isReconnecting, signOut, refreshProfile }}>
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
