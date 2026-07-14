import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { setAccessToken, getAccessToken, apiFetch } from '../api/client';
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
  // True while we're checking the stored token — prevents a flash to /login on refresh
  const [bootstrapping, setBootstrapping] = useState(() => Boolean(getAccessToken()));

  useEffect(() => {
    if (!getAccessToken()) {
      setBootstrapping(false);
      return;
    }
    // Token exists — verify it and restore the admin object
    apiFetch<PlatformAdmin>('/api/v1/platform/auth/me')
      .then((me) => setAdmin(me))
      .catch(() => {
        // Token is expired or invalid — clear it
        setAccessToken(null);
      })
      .finally(() => setBootstrapping(false));
  }, []);

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

  if (bootstrapping) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}
