import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAccessToken, getAccessToken, apiFetch, ApiError } from '../api/client';
import type { AuthenticatedUser } from '../api/types';
import { saveUserCache, loadUserCache } from './offline-cache';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthenticatedUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  // Start loading only if a stored token exists — avoid flicker when there's no session.
  const [isLoading, setIsLoading] = useState(() => Boolean(getAccessToken()));

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    apiFetch<AuthenticatedUser>('/api/v1/auth/me')
      .then((me) => {
        setUser(me);
        saveUserCache(me);
      })
      .catch((err) => {
        if (!(err instanceof ApiError)) {
          // Network error: server unreachable — restore session from offline cache
          const cached = loadUserCache();
          if (cached) {
            setUser(cached.data);
            return;
          }
        }
        // Server rejected the token (401/403) or no offline cache — force re-login
        setAccessToken(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user) && Boolean(getAccessToken()),
      isLoading,
      login: (token, loggedInUser) => {
        setAccessToken(token);
        setUser(loggedInUser);
        saveUserCache(loggedInUser);
      },
      logout: () => {
        setAccessToken(null);
        setUser(null);
      },
      refreshUser: async () => {
        const me = await apiFetch<AuthenticatedUser>('/api/v1/auth/me');
        setUser(me);
        saveUserCache(me);
      },
    }),
    [user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
