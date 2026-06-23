import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { setAccessToken, getAccessToken } from '../api/client';
import type { PlatformAdmin } from '../api/types';

interface AuthContextValue {
  admin: PlatformAdmin | null;
  isAuthenticated: boolean;
  login: (token: string, admin: PlatformAdmin) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin,
      isAuthenticated: Boolean(admin) && Boolean(getAccessToken()),
      login: (token, loggedInAdmin) => {
        setAccessToken(token);
        setAdmin(loggedInAdmin);
      },
      logout: () => {
        setAccessToken(null);
        setAdmin(null);
      },
    }),
    [admin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
