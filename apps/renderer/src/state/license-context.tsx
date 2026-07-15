import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { LicenseStatus } from '../api/types';
import { useAuth } from './auth-context';
import { saveLicenseCache, loadLicenseCache } from './offline-cache';

interface LicenseContextValue {
  status: LicenseStatus | null;
  isBlocked: boolean;
  isOffline: boolean;
  offlineDaysRemaining: number;
  offlineCacheExpired: boolean;
}

const LicenseContext = createContext<LicenseContextValue | undefined>(undefined);

const POLL_INTERVAL_MS = 60_000;

export function LicenseProvider({ children }: { children: ReactNode }): JSX.Element {
  const { isAuthenticated } = useAuth();
  const [cachedStatus, setCachedStatus] = useState<LicenseStatus | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [offlineDaysRemaining, setOfflineDaysRemaining] = useState(0);
  const [offlineCacheExpired, setOfflineCacheExpired] = useState(false);

  const { data, isError } = useQuery({
    queryKey: ['license-status'],
    queryFn: () => apiFetch<LicenseStatus>('/api/v1/license/status'),
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  // Persist fresh server data and clear offline state
  useEffect(() => {
    if (data) {
      saveLicenseCache(data);
      setIsOffline(false);
      setOfflineCacheExpired(false);
    }
  }, [data]);

  // When the fetch fails and there is no in-memory data, fall back to the offline cache
  useEffect(() => {
    if (isError && !data) {
      const cached = loadLicenseCache();
      if (cached) {
        setCachedStatus(cached.data);
        setOfflineDaysRemaining(cached.daysRemaining);
        setIsOffline(true);
        setOfflineCacheExpired(false);
      } else {
        setIsOffline(true);
        setOfflineCacheExpired(true);
      }
    }
  }, [isError, data]);

  const effectiveStatus = data ?? cachedStatus;

  const value = useMemo<LicenseContextValue>(
    () => ({
      status: effectiveStatus,
      isBlocked: offlineCacheExpired || (effectiveStatus?.blocked ?? false),
      isOffline,
      offlineDaysRemaining,
      offlineCacheExpired,
    }),
    [effectiveStatus, isOffline, offlineDaysRemaining, offlineCacheExpired],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

export function useLicense(): LicenseContextValue {
  const context = useContext(LicenseContext);
  if (!context) throw new Error('useLicense must be used within a LicenseProvider.');
  return context;
}
