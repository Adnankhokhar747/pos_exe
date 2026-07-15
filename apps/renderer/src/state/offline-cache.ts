import type { AuthenticatedUser, LicenseStatus } from '../api/types';

const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const USER_KEY = 'vantage.offline.user';
const LICENSE_KEY = 'vantage.offline.license';

interface CacheEntry<T> {
  data: T;
  savedAt: string; // ISO timestamp
}

function write<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, savedAt: new Date().toISOString() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* storage full — ignore */
  }
}

function read<T>(key: string): { data: T; daysRemaining: number } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    const expiresAt = new Date(entry.savedAt).getTime() + OFFLINE_GRACE_MS;
    const now = Date.now();
    if (now > expiresAt) return null;
    const daysRemaining = Math.ceil((expiresAt - now) / (24 * 60 * 60 * 1000));
    return { data: entry.data, daysRemaining };
  } catch {
    return null;
  }
}

export function saveUserCache(user: AuthenticatedUser): void {
  write(USER_KEY, user);
}

export function loadUserCache(): { data: AuthenticatedUser; daysRemaining: number } | null {
  return read(USER_KEY);
}

export function saveLicenseCache(status: LicenseStatus): void {
  write(LICENSE_KEY, status);
}

export function loadLicenseCache(): { data: LicenseStatus; daysRemaining: number } | null {
  return read(LICENSE_KEY);
}

export function clearOfflineCache(): void {
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LICENSE_KEY);
}
