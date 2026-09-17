const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

interface FetchOptions extends RequestInit {
  data?: any;
}

export async function apiFetch<T = any>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { data, headers, ...customConfig } = options;

  const config: RequestInit = {
    method: data ? 'POST' : 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...headers,
    },
    ...customConfig,
  };

  if (data) {
    config.body = JSON.stringify(data);
  }

  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
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
