import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { setAccessToken, getAccessToken, apiFetch } from '../api/client';
import type { AuthenticatedUser } from '../api/types';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, user: AuthenticatedUser) => void;
  logout: () => void;
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
      .then((me) => setUser(me))
      .catch(() => {
        // Token is expired or invalid — clear it so the user lands on login cleanly.
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
      },
      logout: () => {
        setAccessToken(null);
        setUser(null);
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
