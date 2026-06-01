import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { api, AuthResponse, AuthUser } from '@/src/api/client';
import { storage } from '@/src/utils/storage';
import { useCart } from '@/src/store/cartStore';

const TOKEN_KEY = 'dwaarit.auth.token';

type AuthState = {
  loading: boolean;
  token: string | null;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signUp: (email: string, password: string, name: string) => Promise<AuthUser>;
  signInWithGoogle: () => Promise<AuthUser | null>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

async function saveToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
async function readToken(): Promise<string | null> {
  return (await storage.secureGet(TOKEN_KEY, '' as string)) || null;
}
async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const processedSessionRef = useRef<string | null>(null);

  const fetchMe = useCallback(async (t: string) => {
    const me = await api.get<AuthUser>('/auth/me', t);
    setUser(me);
    return me;
  }, []);

  const applyAuth = useCallback(async (resp: AuthResponse) => {
    await saveToken(resp.token);
    setToken(resp.token);
    setUser(resp.user);
    return resp.user;
  }, []);

  const exchangeSessionId = useCallback(async (sessionId: string) => {
    if (processedSessionRef.current === sessionId) return null;
    processedSessionRef.current = sessionId;
    const resp = await api.post<AuthResponse>('/auth/session', { session_id: sessionId });
    return applyAuth(resp);
  }, [applyAuth]);

  // Bootstrap: handle session_id in URL (web) + existing stored token.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1) Web: check URL for session_id
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const url = window.location.href;
          const sid = parseSessionId(url);
          if (sid) {
            try {
              await exchangeSessionId(sid);
              window.history.replaceState(null, '', window.location.pathname);
              if (!cancelled) setLoading(false);
              return;
            } catch (e) {
              // fall through to token check
            }
          }
        }
        // 2) Mobile: cold-start deep link
        if (Platform.OS !== 'web') {
          const initial = await Linking.getInitialURL();
          if (initial) {
            const sid = parseSessionId(initial);
            if (sid) {
              try {
                await exchangeSessionId(sid);
                if (!cancelled) setLoading(false);
                return;
              } catch {}
            }
          }
        }
        // 3) Existing token
        const existing = await readToken();
        if (existing) {
          try {
            const me = await fetchMe(existing);
            if (!cancelled) {
              setToken(existing);
              setUser(me);
            }
          } catch {
            await clearToken();
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [exchangeSessionId, fetchMe]);

  // Hot deep links on mobile.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const sub = Linking.addEventListener('url', ({ url }) => {
      const sid = parseSessionId(url);
      if (sid) {
        exchangeSessionId(sid).catch(() => {});
      }
    });
    return () => sub.remove();
  }, [exchangeSessionId]);

  const signIn = useCallback(async (email: string, password: string) => {
    const resp = await api.post<AuthResponse>('/auth/login', { email, password });
    return applyAuth(resp);
  }, [applyAuth]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const resp = await api.post<AuthResponse>('/auth/signup', { email, password, name });
    return applyAuth(resp);
  }, [applyAuth]);

  const signInWithGoogle = useCallback(async () => {
    const redirectUrl =
      Platform.OS === 'web' && typeof window !== 'undefined'
        ? window.location.origin + '/'
        : Linking.createURL('auth');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.href = authUrl;
      return null;
    }
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    if (result.type !== 'success' || !result.url) return null;
    const sid = parseSessionId(result.url);
    if (!sid) return null;
    return exchangeSessionId(sid);
  }, [exchangeSessionId]);

  const signOut = useCallback(async () => {
    try {
      if (token) await api.post('/auth/logout', undefined, token);
    } catch {}
    await clearToken();
    setToken(null);
    setUser(null);
    try { useCart.getState().clear(); } catch {}
  }, [token]);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      await fetchMe(token);
    } catch {
      await signOut();
    }
  }, [token, fetchMe, signOut]);

  const value = useMemo<AuthState>(
    () => ({ loading, token, user, signIn, signUp, signInWithGoogle, signOut, refresh }),
    [loading, token, user, signIn, signUp, signInWithGoogle, signOut, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function parseSessionId(url: string): string | null {
  if (!url) return null;
  try {
    // hash fragment: foo#session_id=xxx
    const hashIdx = url.indexOf('#');
    if (hashIdx >= 0) {
      const hash = url.slice(hashIdx + 1);
      const params = new URLSearchParams(hash);
      const v = params.get('session_id');
      if (v) return v;
    }
    // query param: foo?session_id=xxx
    const qIdx = url.indexOf('?');
    if (qIdx >= 0) {
      const q = url.slice(qIdx + 1).split('#')[0];
      const params = new URLSearchParams(q);
      const v = params.get('session_id');
      if (v) return v;
    }
  } catch {}
  return null;
}
