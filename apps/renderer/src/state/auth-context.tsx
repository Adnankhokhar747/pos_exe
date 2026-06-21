import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { setAccessToken, getAccessToken } from '../api/client';
import type { AuthenticatedUser } from '../api/types';

interface AuthContextValue {
  user: AuthenticatedUser | null;
  isAuthenticated: boolean;
  login: (token: string, user: AuthenticatedUser) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<AuthenticatedUser | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user) && Boolean(getAccessToken()),
      login: (token, loggedInUser) => {
        setAccessToken(token);
        setUser(loggedInUser);
      },
      logout: () => {
        setAccessToken(null);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
