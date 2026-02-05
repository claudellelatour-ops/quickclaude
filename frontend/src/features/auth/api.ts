import { apiPost, apiGet } from '@/api/client';
import { useAuthStore } from './store';

interface LoginInput {
  email: string;
  password: string;
}

interface RegisterInput {
  email: string;
  password: string;
  name: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

interface UserResponse {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  companies: Array<{
    id: string;
    name: string;
    logo: string | null;
    role: string;
    isDefault: boolean;
  }>;
}

export async function login(input: LoginInput) {
  const response = await apiPost<AuthResponse>('/auth/login', input);

  if (response.success && response.data) {
    const { user, tokens } = response.data;
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);

    // Fetch user details with companies
    await fetchCurrentUser();
  }

  return response;
}

export async function register(input: RegisterInput) {
  const response = await apiPost<AuthResponse>('/auth/register', input);

  if (response.success && response.data) {
    const { user, tokens } = response.data;
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
  }

  return response;
}

export async function fetchCurrentUser() {
  const response = await apiGet<UserResponse>('/auth/me');

  if (response.success && response.data) {
    const { companies, ...user } = response.data;
    useAuthStore.getState().setUser(user);
    useAuthStore.getState().setCompanies(companies);
  }

  return response;
}

export async function logout() {
  try {
    await apiPost('/auth/logout');
  } finally {
    useAuthStore.getState().logout();
  }
}
