import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { LicenseStatus } from '../api/types';
import { useAuth } from './auth-context';

interface LicenseContextValue {
  status: LicenseStatus | null;
  isBlocked: boolean;
}

const LicenseContext = createContext<LicenseContextValue | undefined>(undefined);

// Polls the live license/subscription status while a session is open, rather than
// relying on a cron/email — the only signal a blocked/expiring company gets is this
// poll plus the LicenseGuard re-check the branch-api already does on every request.
const POLL_INTERVAL_MS = 60_000;

export function LicenseProvider({ children }: { children: ReactNode }): JSX.Element {
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ['license-status'],
    queryFn: () => apiFetch<LicenseStatus>('/api/v1/license/status'),
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const value = useMemo<LicenseContextValue>(
    () => ({
      status: data ?? null,
      isBlocked: data?.blocked ?? false,
    }),
    [data],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (!context) throw new Error('useLicense must be used within a LicenseProvider.');
  return context;
}
