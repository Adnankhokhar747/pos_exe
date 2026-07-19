import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import type { Currency, TenantSettings } from '../api/types';

interface UseCurrencyResult {
  /** Symbol string, e.g. "﷼" or "$". Falls back to the code (e.g. "QAR") while loading. */
  symbol: string;
  /** ISO code, e.g. "QAR". Empty string while loading. */
  code: string;
  /** Decimal places defined for this currency (default 2). */
  decimalPlaces: number;
  /** Format a number as a currency string, e.g. "QAR 1,250.00" */
  fmt: (value: number | string | null | undefined) => string;
}

export function useCurrency(): UseCurrencyResult {
  const { data: settings } = useQuery<TenantSettings>({
    queryKey: ['tenant-settings'],
    queryFn: () => apiFetch<TenantSettings>('/api/v1/settings'),
    staleTime: 5 * 60 * 1000,
  });

  const { data: currencies = [] } = useQuery<Currency[]>({
    queryKey: ['currencies'],
    queryFn: () => apiFetch<Currency[]>('/api/v1/currencies'),
    staleTime: 60 * 60 * 1000,
  });

  return useMemo(() => {
    const code   = settings?.baseCurrency ?? '';
    const found  = currencies.find((c) => c.code === code);
    const symbol = found?.symbol ?? code;
    const dp     = found?.decimalPlaces ?? 2;

    function fmt(value: number | string | null | undefined): string {
      const n = parseFloat(String(value ?? 0));
      const formatted = isNaN(n) ? '0.' + '0'.repeat(dp) : n.toFixed(dp);
      return symbol ? `${symbol} ${formatted}` : formatted;
    }

    return { symbol, code, decimalPlaces: dp, fmt };
  }, [settings, currencies]);
}
