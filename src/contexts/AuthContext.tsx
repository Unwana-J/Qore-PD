import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Role } from '../types';

interface AuthContextType {
  user: User | null;
  profile: { name: string; role: Role } | null;
  loading: boolean;
  profileLoading: boolean;
  isReconnecting: boolean;
  loadingStage: 'auth' | 'profile' | 'ready';
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
  const [loadingStage, setLoadingStage] = useState<'auth' | 'profile' | 'ready'>('auth');

  /**
   * Prevents the double-fetch race condition:
   * initializeAuth() and onAuthStateChange(SIGNED_IN) can both fire on load.
   * This flag ensures only one profile fetch runs at a time.
   */
  const isFetchingProfile = useRef(false);
  const hasFetchedOnce = useRef(false);

  /**
   * Fetch the user profile from the DB.
   * Timeout is 30s (up from 15s) to allow for slow networks and Supabase cold starts.
   * Retries up to 2 times with exponential backoff (2s, 4s).
   * Sets isReconnecting on retries so the UI shows a soft banner instead of a hard error.
   */
  const fetchProfile = useCallback(async (userId: string, retryCount = 0): Promise<void> => {
    // Prevent concurrent fetches
    if (isFetchingProfile.current && retryCount === 0) {
      console.log('[Auth] Profile fetch already in progress, skipping duplicate call.');
      return;
    }

    isFetchingProfile.current = true;
    setLoadingStage('profile');

    // 30 second timeout — safety net for cold starts
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Profile fetch timeout')), 30000)
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
          const delayMs = 2000 * (retryCount + 1); // 2s, 4s
          console.warn(`[Auth] Profile fetch error (attempt ${retryCount + 1}). Retrying in ${delayMs / 1000}s...`);
          setIsReconnecting(true);
          await new Promise(r => setTimeout(r, delayMs));
          isFetchingProfile.current = false;
          return fetchProfile(userId, retryCount + 1);
        }
        console.error('[Auth] Profile fetch permanently failed after retries.', error);
        setProfile(prev => prev || null); // Keep existing profile if found
      } else if (data) {
        console.log('[Auth] Profile fetched successfully.');
        setProfile({ name: data.name, role: data.role as Role });
        hasFetchedOnce.current = true;
        setLoadingStage('ready');
      } else {
        console.error('[Auth] User exists but NO PROFILE ROW found in public.profiles.');
        setProfile(null);
      }
    } catch (err) {
      if (retryCount < 2) {
        const delayMs = 2000 * (retryCount + 1);
        console.warn(`[Auth] Profile timeout (attempt ${retryCount + 1}). Retrying in ${delayMs / 1000}s...`);
        setIsReconnecting(true);
        await new Promise(r => setTimeout(r, delayMs));
        isFetchingProfile.current = false;
        return fetchProfile(userId, retryCount + 1);
      }
      console.error('[Auth] Profile fetch timed out after all retries.', err);
      // Soft Fail: Keep existing profile on background timeout
      setProfile(prev => prev || null); 
    } finally {
      isFetchingProfile.current = false;
      setProfileLoading(false);
      setIsReconnecting(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      console.log('[Auth] Starting initialization...');
      setLoadingStage('auth');
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
          setLoadingStage('ready');
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        setUser(null);
        setProfile(null);
        setLoadingStage('ready');
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
        setLoadingStage('ready');
        import('../lib/safety').then(({ safety }) => safety.clearAllDataAndLogout());
        return;
      }

      // TOKEN_REFRESHED fires after idle — silently re-sync profile
      if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('[Auth] Token refreshed — re-syncing profile silently.');
        setIsReconnecting(true);
        setUser(session.user);
        await fetchProfile(session.user.id);
        return;
      }

      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        // Skip if initializeAuth() is already handling the initial profile fetch
        // This prevents the double-fetch race condition.
        if (event === 'SIGNED_IN' && hasFetchedOnce.current) {
          console.log('[Auth] SIGNED_IN event — profile already fetched by init, skipping duplicate.');
          return;
        }
        console.log('[Auth] User signed in/updated. Syncing profile...');
        setUser(session.user);
        setProfileLoading(true);
        await fetchProfile(session.user.id);
        setProfileLoading(false);
        setLoading(false);
      } else if (!session) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setLoadingStage('ready');
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
      setLoadingStage('ready');
      const { safety } = await import('../lib/safety');
      safety.clearAllDataAndLogout();
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, isReconnecting, loadingStage, signOut, refreshProfile }}>
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
