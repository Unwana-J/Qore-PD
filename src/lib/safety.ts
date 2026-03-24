import { APP_STORAGE_VERSION } from '../constants';

export const safety = {
  checkStorageVersion: () => {
    try {
      const storedVersion = localStorage.getItem('app_storage_version');
      if (storedVersion !== APP_STORAGE_VERSION) {
        console.warn(`[Safety] Version mismatch (Stored: ${storedVersion}, App: ${APP_STORAGE_VERSION}). Skipping auto-clear.`);
        localStorage.setItem('app_storage_version', APP_STORAGE_VERSION);
      }
    } catch (err) {
      console.error('[Safety] Cache version check failed:', err);
      localStorage.clear();
    }
  },

  safeGetStorage: (key: string, type: 'local' | 'session' = 'local') => {
    try {
      const storage = type === 'local' ? localStorage : sessionStorage;
      const data = storage.getItem(key);
      // Attempt to parse if it looks like JSON, but return as is if not
      // This helps catch corrupted Supabase session strings
      if (data && (data.startsWith('{') || data.startsWith('['))) {
        try {
          JSON.parse(data);
        } catch (e) {
          throw new Error('Corrupted JSON in storage');
        }
      }
      return data;
    } catch (err) {
      console.error(`[Safety] Failed to read or parse ${type}Storage key: ${key}`, err);
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
      return null;
    }
  },


  safeSetStorage: (key: string, value: string, type: 'local' | 'session' = 'local') => {
    try {
      const storage = type === 'local' ? localStorage : sessionStorage;
      storage.setItem(key, value);
    } catch (err) {
      console.error(`[Safety] Failed to write ${type}Storage key: ${key}`, err);
      localStorage.clear();
      sessionStorage.clear();
      window.location.reload();
    }
  },

  clearAllDataAndLogout: () => {
    localStorage.clear();
    sessionStorage.clear();
    // Clear cookies (best effort)
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.href = '/';
  }
};
