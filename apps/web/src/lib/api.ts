import { supabase } from './supabase';

export const API_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ''
).replace(/\/$/, '');

export function getApiUrl(endpoint: string = ''): string {
  const path = endpoint.replace(/^\//, '');
  return API_URL ? `${API_URL}/${path}` : `/${path}`;
}

export interface FetchOptions extends RequestInit {
  data?: any;
}

export function getStoredAuthToken(): string | null {
  try {
    return localStorage.getItem('nw_token');
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string): void {
  try {
    localStorage.setItem('nw_token', token);
  } catch {
    // Ignore localStorage write failures
  }
}

export function clearStoredAuthToken(): void {
  try {
    localStorage.removeItem('nw_token');
  } catch {
    // Ignore
  }
}

export async function getValidAuthToken(): Promise<string | null> {
  // 1. Direct minted application token if present
  const stored = getStoredAuthToken();
  if (stored) return stored;

  // 2. Supabase session token with auto-refresh if close to expiration
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData?.session) {
      const expiresAtSec = sessionData.session.expires_at;
      const isExpiringSoon = expiresAtSec ? expiresAtSec * 1000 < Date.now() + 60000 : false;
      if (isExpiringSoon) {
        try {
          const { data: refreshed } = await supabase.auth.refreshSession();
          return refreshed?.session?.access_token || sessionData.session.access_token;
        } catch {
          return sessionData.session.access_token;
        }
      }
      return sessionData.session.access_token;
    }
  } catch {
    // Ignore
  }
  return null;
}

export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { data, headers, ...customConfig } = options;

  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  // Add Authorization Bearer header if available and not explicitly provided
  if (!customHeaders['Authorization'] && !customHeaders['authorization']) {
    const token = await getValidAuthToken();
    if (token) {
      customHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    credentials: 'include',
    headers: customHeaders,
    ...customConfig,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const url = getApiUrl(endpoint);
  let response = await fetch(url, config);

  // If 401 Unauthorized, attempt a session refresh & single transparent retry
  if (response.status === 401) {
    clearStoredAuthToken();
    try {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session?.access_token) {
        customHeaders['Authorization'] = `Bearer ${refreshed.session.access_token}`;
        response = await fetch(url, {
          ...config,
          headers: customHeaders,
        });
      }
    } catch {
      // Ignore refresh error; allow normal 401 error response
    }
  }

  if (response.status === 204) {
    return {} as T;
  }

  const resData = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      resData.message || (Array.isArray(resData.message) ? resData.message.join(', ') : 'Request failed');
    throw new Error(errorMsg);
  }

  return resData as T;
}

