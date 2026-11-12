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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

  // Read response text stream exactly once to prevent "body stream already read"
  const rawText = await response.text();
  let parsedData: any = null;
  if (rawText) {
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = rawText;
    }
  }

  if (!response.ok) {
    let errorMessage = `Request failed with status ${response.status}`;
    if (typeof parsedData?.detail === 'string') {
      errorMessage = parsedData.detail;
    } else if (Array.isArray(parsedData?.detail)) {
      errorMessage = parsedData.detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
    } else if (parsedData?.message) {
      errorMessage = parsedData.message;
    } else if (typeof parsedData === 'string' && parsedData.trim().length > 0) {
      errorMessage = parsedData;
    }

    // Cleanly clear token on 401 Unauthorized to invalidate expired session
    if (response.status === 401) {
      localStorage.removeItem('petrails_auth_token');
    }

    throw new ApiError(response.status, errorMessage, parsedData);
  }

  // If 204 No Content or empty body
  if (response.status === 204 || parsedData === null) {
    return {} as T;
  }

  return parsedData as T;
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

  postForm: <T>(endpoint: string, formData: FormData, options?: RequestInit) =>
    request<T>(
      endpoint,
      {
        method: 'POST',
        body: formData,
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
