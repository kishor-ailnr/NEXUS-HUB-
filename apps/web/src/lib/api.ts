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

export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { data, headers, ...customConfig } = options;

  const customHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  // Add Authorization Bearer header if available from active session and not explicitly provided
  if (!customHeaders['Authorization'] && !customHeaders['authorization']) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.access_token) {
        customHeaders['Authorization'] = `Bearer ${sessionData.session.access_token}`;
      }
    } catch {
      // Ignore if supabase session retrieval fails
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
  const response = await fetch(url, config);

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

