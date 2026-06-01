import { useEffect, useState } from 'react';

/**
 * Reads the persisted auth token from secure storage so screens that aren't
 * wrapped in AuthContext consumers can still call the backend on behalf of
 * the current user. Same pattern as `useToken` in the rider portal.
 */
export function useStoreToken() {
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { storage } = await import('@/src/utils/storage');
      const t = (await storage.secureGet('dwaarit.auth.token', '' as string)) || null;
      if (!cancelled) setToken(t);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return token;
}
