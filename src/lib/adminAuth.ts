'use client';

import { notifyAdminSessionExpired } from './storefrontSync';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'Super Admin' | 'Catalog Manager' | 'Inventory Admin' | 'Order Manager';
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

let inMemoryAdminToken: string | null = null;

function getStoredBearerToken(): string | null {
  return inMemoryAdminToken;
}

export function setAdminMemoryToken(token: string | null): void {
  inMemoryAdminToken = token;
}

export function handleAdminUnauthorized(status?: number, errorMessage?: string): boolean {
  const inactiveOrMissing =
    status === 403 &&
    typeof errorMessage === 'string' &&
    errorMessage.toLowerCase().includes('inactive or missing');
  if (status === 401 || inactiveOrMissing) {
    setAdminMemoryToken(null);
    notifyAdminSessionExpired();
    return true;
  }
  return false;
}

export function getAdminAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
    ...(extra || {}),
  };
  const token = getStoredBearerToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function checkAdminSession(): Promise<{
  authenticated: boolean;
  user?: AdminUser;
  admins?: AdminUser[];
}> {
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'GET',
      credentials: 'include',
      headers: getAdminAuthHeaders(),
      cache: 'no-store',
    });
    if (!res.ok) {
      if (res.status === 401) {
        setAdminMemoryToken(null);
      }
      return { authenticated: false };
    }
    const data = await res.json();
    if (!data.authenticated) {
      setAdminMemoryToken(null);
    }
    return {
      authenticated: Boolean(data.authenticated),
      user: data.user,
      admins: data.admins,
    };
  } catch {
    return { authenticated: false };
  }
}

export async function adminSignIn(
  emailInput: string,
  passwordInput: string
): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        action: 'login',
        email: emailInput.trim(),
        password: passwordInput,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Authentication failed' };
    }

    if (data.token) {
      setAdminMemoryToken(data.token);
    }
    return { success: true, user: data.user };
  } catch {
    return { success: false, error: 'Network error during authentication' };
  }
}

export async function adminSignUp(params: {
  name: string;
  email: string;
  password: string;
  role?: AdminUser['role'];
  passcode?: string;
}): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({
        action: 'signup',
        ...params,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Registration failed' };
    }

    if (data.token) {
      setAdminMemoryToken(data.token);
    }
    return { success: true, user: data.user };
  } catch {
    return { success: false, error: 'Network error during registration' };
  }
}

export async function adminSignOut(): Promise<void> {
  setAdminMemoryToken(null);
  try {
    await fetch('/api/admin/auth', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ action: 'logout' }),
    });
  } catch {
    // ignore
  }
}
