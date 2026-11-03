import { apiClient } from './apiClient';

export interface LoginCredentials {
  email: string;
  password?: string;
}

export interface RegisterPayload {
  organization: string;
  fullName: string;
  workEmail: string;
  role: string;
  authorityTier: string;
  password?: string;
}

export interface AuthResponse {
  token: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    authorityLimitInr: number;
    organization: string;
  };
}

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/login', credentials);
    if (res?.token) {
      localStorage.setItem('petrails_auth_token', res.token);
    }
    return res;
  },

  async register(payload: RegisterPayload): Promise<AuthResponse> {
    const res = await apiClient.post<AuthResponse>('/auth/register', payload);
    if (res?.token) {
      localStorage.setItem('petrails_auth_token', res.token);
    }
    return res;
  },

  async getCurrentUser(): Promise<AuthResponse['user'] | null> {
    const token = localStorage.getItem('petrails_auth_token');
    if (!token) return null;
    try {
      return await apiClient.get<AuthResponse['user']>('/auth/me');
    } catch {
      localStorage.removeItem('petrails_auth_token');
      return null;
    }
  },

  logout(): void {
    localStorage.removeItem('petrails_auth_token');
  }
};
