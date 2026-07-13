import type { DashboardData, Role, User } from '@compass/shared';

export class ApiFailure extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiFailure(data.message || 'Something went wrong.', response.status);
  return data as T;
}

export interface LoginResponse { token: string; user: User }
export const login = (email: string, password: string) => api<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const getDashboard = (token: string) => api<DashboardData>('/dashboard', {}, token);

export const roleLabel: Record<Role, string> = { admin: 'Center Director', teacher: 'Classroom Teacher', parent: 'Parent & Guardian' };
