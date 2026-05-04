import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Role } from '../types';

interface AuthContextType {
  user: User | null;
  profile: { 
    name: string; 
    role: Role; 
    email: string; 
    status: string; 
    created_at: string; 
    updated_at: string; 
  } | null;
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
  const [loading, setLoading] = useState(true);
  const [loadingStage, setLoadingStage] = useState<'auth' | 'profile' | 'ready'>('auth');
  const queryClient = useQueryClient();

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      setLoadingStage('auth');
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!mounted) return;
        if (error) throw error;
        setUser(session?.user || null);
        if (!session?.user) {
          setLoadingStage('ready');
        }
      } catch (err) {
        console.error('[Auth] Initialization error:', err);
        setUser(null);
        setLoadingStage('ready');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        queryClient.clear();
        setLoadingStage('ready');
      } else if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user || null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [queryClient]);

  // React Query for profile with stale-while-revalidate
  const { data: profile, isLoading: profileLoading, isFetching: isReconnecting, refetch: refreshProfile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      setLoadingStage('profile');
      const { data, error } = await supabase
        .from('profiles')
        .select('name, role, email, status, created_at, updated_at')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setLoadingStage('ready');
      return { 
        name: data.name, 
        role: data.role as Role,
        email: data.email,
        status: data.status || 'Active',
        created_at: data.created_at,
        updated_at: data.updated_at
      };
    },
    enabled: !!user?.id,
    staleTime: 10000, // 10 second stale-while-revalidate — keeps role changes snappy
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000), // Exponential backoff max 30s
  });

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setLoading(false);
      setLoadingStage('ready');
      queryClient.clear();
      const { safety } = await import('../lib/safety');
      safety.clearAllDataAndLogout();
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile: profile || null, 
      loading, 
      profileLoading, 
      isReconnecting: isReconnecting && !profileLoading, 
      loadingStage: isReconnecting && profile ? 'ready' : loadingStage, 
      signOut, 
      refreshProfile: async () => { await refreshProfile(); } 
    }}>
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
