// PETRAILS API Client
// Handles HTTP requests, JWT authorization headers, error normalization, and session handling

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}`;
  
  const token = localStorage.getItem('petrails_auth_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorData: any = null;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }

    let errorMessage = `Request failed with status ${response.status}`;
    if (typeof errorData?.detail === 'string') {
      errorMessage = errorData.detail;
    } else if (Array.isArray(errorData?.detail)) {
      errorMessage = errorData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
    } else if (errorData?.message) {
      errorMessage = errorData.message;
    }

    // Cleanly clear token on 401 Unauthorized to invalidate expired session
    if (response.status === 401) {
      localStorage.removeItem('petrails_auth_token');
    }

    throw new ApiError(response.status, errorMessage, errorData);
  }

  // If 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return await response.json();
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'GET', ...options }),

  post: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(
      endpoint,
      {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      }
    ),

  put: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(
      endpoint,
      {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      }
    ),

  patch: <T>(endpoint: string, body?: any, options?: RequestInit) =>
    request<T>(
      endpoint,
      {
        method: 'PATCH',
        body: body ? JSON.stringify(body) : undefined,
        ...options,
      }
    ),

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: 'DELETE', ...options }),
};
