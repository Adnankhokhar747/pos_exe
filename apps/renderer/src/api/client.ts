const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:4000';
const TOKEN_STORAGE_KEY = 'vantage.accessToken';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly code: string = '',
  ) {
    super(detail);
  }
}

export async function apiFetch<T>(path: string, options: Omit<RequestInit, 'body'> & { body?: unknown } = {}): Promise<T> {
  const token = getAccessToken();
  const { body, ...rest } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...rest.headers,
    },
  });

  if (!response.ok) {
    // Expired / invalid token — clear session and force re-login immediately
    if (response.status === 401) {
      setAccessToken(null);
      window.location.replace('/login');
      throw new ApiError(401, 'Session expired. Please log in again.', 'session_expired');
    }

    const problem = await response.json().catch(() => ({ message: response.statusText }));
    // Laravel 422 validation errors: { message: "...", errors: { field: ["msg"] } }
    let detail = problem.detail ?? problem.message ?? 'Request failed.';
    if (response.status === 422 && problem.errors) {
      const firstField = Object.values(problem.errors as Record<string, string[]>)[0];
      if (firstField?.[0]) detail = firstField[0];
    }
    throw new ApiError(response.status, detail, problem.title ?? '');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
