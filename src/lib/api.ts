async function request<T>(
  url: string,
  options?: RequestInit
): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(url, {
      ...options,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || 'Something went wrong.' };
    return { data: json };
  } catch {
    return { error: 'Could not reach the server. Please check your connection.' };
  }
}

import type { AuthResponse } from '../types';

export const api = {
  signup: (username: string, email: string, password: string, confirmPassword: string) =>
    request<AuthResponse>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ username, email, password, confirmPassword }),
    }),

  login: (identifier: string, password: string) =>
    request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  logout: () => request('/api/auth/logout', { method: 'POST' }),

  me: () =>
    request<AuthResponse & { user: import('../types').User }>('/api/auth/me'),

  sendVerifyLink: () =>
    request('/api/auth/send-verify-link', { method: 'POST' }),

  sendOTP: () =>
    request('/api/auth/send-otp', { method: 'POST' }),

  verifyByLink: (token: string) =>
    request('/api/auth/verify-by-link', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  verifyByOTP: (otp: string) =>
    request('/api/auth/verify-by-otp', {
      method: 'POST',
      body: JSON.stringify({ otp }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (params: {
    token?: string;
    otp?: string;
    email?: string;
    newPassword: string;
  }) =>
    request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify(params),
    }),
};
