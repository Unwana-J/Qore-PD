import { createClient } from '@supabase/supabase-js';

import { safety } from './safety';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing from .env');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
  auth: {
    persistSession: true,      // Keep session in localStorage across tabs/refreshes
    autoRefreshToken: true,    // Silently renew access token before expiry (every ~1hr)
    detectSessionInUrl: true,  // Handle magic links and OAuth redirects
    storage: {
      getItem: (key) => safety.safeGetStorage(key),
      setItem: (key, value) => safety.safeSetStorage(key, value),
      removeItem: (key) => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          localStorage.clear();
        }
      }
    }
  }
});

