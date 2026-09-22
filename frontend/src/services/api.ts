/**
 * Cliente HTTP base para la comunicación con microservicios de Centavo.
 */

const AUTH_TOKEN_KEY = 'centavo_auth_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const token = getStoredToken();
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(url, {
    ...rest,
    headers: {
      ...authHeaders,
      ...headers,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Error en la solicitud: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
}
