import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { ModuleStatus } from '../api/types';
import { useAuth } from './auth-context';

interface ModulesContextValue {
  modules: ModuleStatus[];
  isModuleEnabled: (code: string) => boolean;
}

const ModulesContext = createContext<ModulesContextValue | undefined>(undefined);

// Mirrors LicenseProvider's polling: a Super Admin can enable/disable a plugin module
// for this company at any time, and the renderer must reflect that within the same
// 60s window the license/expiry banner already uses, without a page refresh.
const POLL_INTERVAL_MS = 60_000;

export function ModulesProvider({ children }: { children: ReactNode }): JSX.Element {
  const { isAuthenticated } = useAuth();

  const { data } = useQuery({
    queryKey: ['module-status'],
    queryFn: () => apiFetch<ModuleStatus[]>('/api/v1/modules/status'),
    enabled: isAuthenticated,
    refetchInterval: POLL_INTERVAL_MS,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const value = useMemo<ModulesContextValue>(() => {
    const modules = data ?? [];
    return {
      modules,
      isModuleEnabled: (code: string) => modules.some((m) => m.moduleCode === code && m.enabled && !m.blocked),
    };
  }, [data]);

  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules(): ModulesContextValue {
  const context = useContext(ModulesContext);
  if (!context) throw new Error('useModules must be used within a ModulesProvider.');
  return context;
}
