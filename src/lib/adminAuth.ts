'use client';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: 'Super Admin' | 'Catalog Manager' | 'Inventory Admin';
  status: 'active' | 'inactive';
  createdAt: string;
  lastLogin?: string;
}

export const DEFAULT_ADMIN_USER: AdminUser = {
  id: 'admin-soyab-super',
  name: 'Soyab Shaikh',
  email: 'soyxbshxikh@gmail.com',
  password: 'Soyab@8830',
  role: 'Super Admin',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const ADMIN_USERS_KEY = 'stepstyle_admin_users';
const ADMIN_SESSION_KEY = 'stepstyle_admin_session';

/**
 * Get all registered admin users from localStorage.
 * Ensures the default admin (soyxbshxikh@gmail.com) is always present.
 */
export function getAdminUsers(): AdminUser[] {
  if (typeof window === 'undefined') {
    return [DEFAULT_ADMIN_USER];
  }

  try {
    const raw = localStorage.getItem(ADMIN_USERS_KEY);
    if (!raw) {
      localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify([DEFAULT_ADMIN_USER]));
      return [DEFAULT_ADMIN_USER];
    }

    const parsed: AdminUser[] = JSON.parse(raw);
    
    // Ensure Soyab Shaikh's account always exists and has the requested password
    const defaultExistsIndex = parsed.findIndex(
      (u) => u.email.toLowerCase() === DEFAULT_ADMIN_USER.email.toLowerCase()
    );

    if (defaultExistsIndex === -1) {
      parsed.unshift(DEFAULT_ADMIN_USER);
      localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(parsed));
    } else {
      // Keep credentials fresh as requested by user
      parsed[defaultExistsIndex] = {
        ...parsed[defaultExistsIndex],
        email: DEFAULT_ADMIN_USER.email,
        password: DEFAULT_ADMIN_USER.password,
        name: parsed[defaultExistsIndex].name || DEFAULT_ADMIN_USER.name,
        role: 'Super Admin',
        status: 'active',
      };
      localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(parsed));
    }

    return parsed;
  } catch (err) {
    console.error('Failed to read admin users:', err);
    return [DEFAULT_ADMIN_USER];
  }
}

/**
 * Save admin users list to localStorage
 */
export function saveAdminUsers(users: AdminUser[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ADMIN_USERS_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save admin users:', err);
  }
}

/**
 * Get currently active admin session
 */
export function getAdminSession(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ADMIN_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AdminUser;
  } catch (err) {
    console.error('Failed to read admin session:', err);
    return null;
  }
}

/**
 * Authenticate admin by email and password
 */
export function adminSignIn(
  emailInput: string,
  passwordInput: string
): { success: boolean; user?: AdminUser; error?: string } {
  const cleanEmail = emailInput.trim().toLowerCase();
  const cleanPassword = passwordInput.trim();

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Please provide both email and password.' };
  }

  const users = getAdminUsers();
  const matchedUser = users.find((u) => u.email.toLowerCase() === cleanEmail);

  if (!matchedUser) {
    return {
      success: false,
      error: 'No administrator account found with this email.',
    };
  }

  if (matchedUser.password !== cleanPassword) {
    return {
      success: false,
      error: 'Invalid password. Please verify your credentials.',
    };
  }

  if (matchedUser.status === 'inactive') {
    return {
      success: false,
      error: 'This administrator account is disabled. Contact super admin.',
    };
  }

  // Update last login
  const updatedUser: AdminUser = {
    ...matchedUser,
    lastLogin: new Date().toISOString(),
  };

  const updatedUsers = users.map((u) => (u.id === matchedUser.id ? updatedUser : u));
  saveAdminUsers(updatedUsers);

  // Set session (without password field in active session object for safety)
  const sessionSafeUser: AdminUser = {
    id: updatedUser.id,
    name: updatedUser.name,
    email: updatedUser.email,
    role: updatedUser.role,
    status: updatedUser.status,
    createdAt: updatedUser.createdAt,
    lastLogin: updatedUser.lastLogin,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionSafeUser));
  }

  return { success: true, user: sessionSafeUser };
}

/**
 * Register a new admin account
 */
export function adminSignUp(params: {
  name: string;
  email: string;
  password: string;
  role?: 'Super Admin' | 'Catalog Manager' | 'Inventory Admin';
}): { success: boolean; user?: AdminUser; error?: string } {
  const cleanName = params.name.trim();
  const cleanEmail = params.email.trim().toLowerCase();
  const cleanPassword = params.password.trim();
  const role = params.role || 'Catalog Manager';

  if (!cleanName || cleanName.length < 2) {
    return { success: false, error: 'Please enter a valid full name.' };
  }

  if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  if (!cleanPassword || cleanPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters long.' };
  }

  const users = getAdminUsers();
  const exists = users.some((u) => u.email.toLowerCase() === cleanEmail);

  if (exists) {
    return {
      success: false,
      error: 'An administrator account already exists with this email.',
    };
  }

  const newAdmin: AdminUser = {
    id: `admin-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: cleanName,
    email: cleanEmail,
    password: cleanPassword,
    role: role,
    status: 'active',
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString(),
  };

  const updatedUsers = [...users, newAdmin];
  saveAdminUsers(updatedUsers);

  // Set session immediately
  const sessionSafeUser: AdminUser = {
    id: newAdmin.id,
    name: newAdmin.name,
    email: newAdmin.email,
    role: newAdmin.role,
    status: newAdmin.status,
    createdAt: newAdmin.createdAt,
    lastLogin: newAdmin.lastLogin,
  };

  if (typeof window !== 'undefined') {
    localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(sessionSafeUser));
  }

  return { success: true, user: sessionSafeUser };
}

/**
 * Sign out current admin
 */
export function adminSignOut(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ADMIN_SESSION_KEY);
  }
}
