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
   * Force-refresh the JWT before fetching the profile.
   * This handles expired tokens after idle periods without showing an error.
   */
  const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<void> => {
    // Step 1: Ensure the JWT is fresh before querying profiles table
    // This silently re-authenticates after idle timeouts
    try {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError) {
        console.warn('[Auth] Session refresh failed:', refreshError.message);
        // Not fatal — continue with existing token
      }
    } catch (e) {
      console.warn('[Auth] Session refresh threw:', e);
    }

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
          console.warn(`[Auth] Profile fetch failed (attempt ${retryCount + 1}). Retrying...`, error);
          await new Promise(r => setTimeout(r, 1500 * (retryCount + 1)));
          return fetchProfile(userId, retryCount + 1);
        }
        console.error('[Auth] Profile fetch failed after all retries.', error);
        setProfile(null);
      } else if (data) {
        setProfile({ name: data.name, role: data.role as Role });
      }
    } catch (err) {
      if (retryCount < 2) {
        console.warn(`[Auth] Profile timeout/error (attempt ${retryCount + 1}). Retrying...`);
        await new Promise(r => setTimeout(r, 1500 * (retryCount + 1)));
        return fetchProfile(userId, retryCount + 1);
      }
      console.error('[Auth] Profile permanently unavailable after retries.', err);
      setProfile(null);
    } finally {
      setProfileLoading(false);
      setIsReconnecting(false);
    }
  }, []);

  useEffect(() => {
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
        console.error('[Auth] Initialization error:', err);
        setUser(null);
        setProfile(null);
      } finally {
        setLoading(false);
        setProfileLoading(false);
      }
    };

    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event);

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
        // fetchProfile clears isReconnecting in its finally block
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        setUser(session.user);
        setProfileLoading(true);
        await fetchProfile(session.user.id);
        setProfileLoading(false);
      } else if (!session) {
        setUser(null);
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
