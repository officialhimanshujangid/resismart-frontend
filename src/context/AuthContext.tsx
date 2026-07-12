'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
// In Next.js App Router, it is 'next/navigation'. Let's import from 'next/navigation'.
import { useRouter as useNextRouter, usePathname } from 'next/navigation';
import api, { setAccessTokenInMemory, getAccessTokenInMemory } from '../lib/api';

export interface IUserProfile {
  tenantType: 'SYSTEM' | 'SOCIETY' | 'SHOP';
  tenantId: string;
  role: string;
}

/** A switchable workspace: one per flat/plot/shop the user holds, plus admin roles. */
export interface IContext {
  contextId: string;
  kind: 'SOCIETY_UNIT' | 'SHOP' | 'ADMIN';
  tenantType: 'SYSTEM' | 'SOCIETY' | 'SHOP';
  tenantId: string;
  tenantName: string;
  unitType: 'FLAT' | 'SHOP' | null;
  unitId: string | null;
  unitLabel: string | null;
  role: string;
}

export interface IModulePermission {
  module: string;
  moduleLabel: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface IUser {
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
}

interface AuthContextType {
  user: IUser | null;
  activeProfile: IUserProfile | null;   // derived from activeContext (kept for guards/sidebar)
  activeContext: IContext | null;
  availableContexts: IContext[];
  employeePermissions: IModulePermission[] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (identifier: string, password: string) => Promise<{ success: boolean; error?: string; useOtp?: boolean }>;
  loginOtpRequest: (identifier: string) => Promise<{ success: boolean; error?: string; devCode?: string; channel?: string }>;
  loginOtpVerify: (identifier: string, code: string) => Promise<{ success: boolean; error?: string }>;
  selectProfileContext: (contextId: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  switchContext: (contextId: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  updateCurrentUser: (userData: Partial<IUser>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const toProfile = (ctx: IContext | null): IUserProfile | null =>
  ctx ? { tenantType: ctx.tenantType, tenantId: ctx.tenantId, role: ctx.role } : null;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [activeContext, setActiveContext] = useState<IContext | null>(null);
  const [availableContexts, setAvailableContexts] = useState<IContext[]>([]);
  const [employeePermissions, setEmployeePermissions] = useState<IModulePermission[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useNextRouter();
  const pathname = usePathname();

  const activeProfile = toProfile(activeContext);

  // Persist a resolved context to state + localStorage (and the legacy activeProfile shape).
  const persistContext = (ctx: IContext | null) => {
    setActiveContext(ctx);
    if (ctx) {
      localStorage.setItem('activeContext', JSON.stringify(ctx));
      localStorage.setItem('activeContextId', ctx.contextId);
      localStorage.setItem('activeProfile', JSON.stringify(toProfile(ctx)));
    }
  };

  const persistContexts = (list: IContext[]) => {
    setAvailableContexts(list || []);
    localStorage.setItem('availableContexts', JSON.stringify(list || []));
  };

  const loadEmployeePermissions = async (role?: string) => {
    if (role === 'SYSTEM_EMPLOYEE') {
      try {
        const permRes = await api.get('/system-employees/me/permissions');
        const perms: IModulePermission[] = permRes.data.permissions ?? [];
        setEmployeePermissions(perms);
        localStorage.setItem('employeePermissions', JSON.stringify(perms));
      } catch (_) {
        setEmployeePermissions([]);
      }
    }
  };

  // Handle initial session validation
  useEffect(() => {
    const initializeAuth = async () => {
      const localRefreshToken = localStorage.getItem('refreshToken');
      const savedUser = localStorage.getItem('user');

      if (!localRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const contextId = localStorage.getItem('activeContextId') || undefined;

        // Hit refresh endpoint to restore the active session under the same unit.
        const response = await api.post('/auth/refresh-token', {
          refreshToken: localRefreshToken,
          contextId,
        });

        const { token, refreshToken: newRefreshToken, activeContext: ctx, availableContexts: list } = response.data;

        setAccessTokenInMemory(token);
        localStorage.setItem('refreshToken', newRefreshToken);

        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }

        if (ctx) persistContext(ctx);
        if (Array.isArray(list)) persistContexts(list);

        await loadEmployeePermissions(ctx?.role);
      } catch (err) {
        console.error('Session auto-login failed:', err);
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('activeContext');
        localStorage.removeItem('activeContextId');
        localStorage.removeItem('activeProfile');
        localStorage.removeItem('availableContexts');
        localStorage.removeItem('user');
        setUser(null);
        setActiveContext(null);
      } finally {
        // Recover cached lists so the switcher renders instantly on refresh.
        const savedContexts = localStorage.getItem('availableContexts');
        if (savedContexts) {
          try { setAvailableContexts(JSON.parse(savedContexts)); } catch (_) {}
        }
        const savedPerms = localStorage.getItem('employeePermissions');
        if (savedPerms) {
          try { setEmployeePermissions(JSON.parse(savedPerms)); } catch (_) {}
        }
        setIsLoading(false);
      }
    };

    initializeAuth();

    const handleForceLogout = () => {
      setUser(null);
      setActiveContext(null);
      router.push('/login');
    };

    window.addEventListener('auth-logout', handleForceLogout);
    return () => {
      window.removeEventListener('auth-logout', handleForceLogout);
    };
  }, [router]);

  // Register
  const register = async (name: string, email: string, password: string) => {
    try {
      await api.post('/auth/register', { name, email, password });
      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Registration failed',
      };
    }
  };

  // Login by email OR phone number.
  const login = async (identifier: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/login', { identifier, password });
      const data = response.data;

      const { token, refreshToken, activeContext: ctx, availableContexts: list, user: loggedUser } = data;

      setAccessTokenInMemory(token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));

      setUser(loggedUser);
      persistContext(ctx);
      persistContexts(list || []);

      await loadEmployeePermissions(ctx?.role);

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.response?.data?.error || 'Invalid credentials',
        useOtp: err.response?.data?.useOtp === true,
      };
    }
  };

  // Passwordless login — step 1: request a one-time code for an email/phone identity.
  const loginOtpRequest = async (identifier: string) => {
    try {
      const res = await api.post('/auth/login/otp/request', { identifier });
      return { success: true, devCode: res.data.devCode as string | undefined, channel: res.data.channel as string };
    } catch (err: any) {
      if (err.response?.status === 429) return { success: false, error: err.response?.data?.error || 'Please wait before requesting another code.' };
      return { success: false, error: err.response?.data?.error || 'Failed to send code' };
    }
  };

  // Passwordless login — step 2: verify the code and establish the session.
  const loginOtpVerify = async (identifier: string, code: string) => {
    try {
      setIsLoading(true);
      const res = await api.post('/auth/login/otp/verify', { identifier, code });
      const { token, refreshToken, activeContext: ctx, availableContexts: list, user: loggedUser } = res.data;

      setAccessTokenInMemory(token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));

      setUser(loggedUser);
      persistContext(ctx);
      persistContexts(list || []);
      await loadEmployeePermissions(ctx?.role);

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return { success: false, error: err.response?.data?.error || 'Verification failed' };
    }
  };

  // Manual context selection (used by the /select-context fallback page).
  // Goes through the refresh-token path (requires the refresh token) — the old
  // credential-less /auth/select-context endpoint was removed for security.
  const selectProfileContext = async (contextId: string, _userId?: string) => {
    try {
      setIsLoading(true);
      const currentRefreshToken = localStorage.getItem('refreshToken');
      if (!currentRefreshToken) throw new Error('No active session');

      const response = await api.post('/auth/refresh-token', { refreshToken: currentRefreshToken, contextId });
      const { token, refreshToken, activeContext: ctx, availableContexts: list } = response.data;

      setAccessTokenInMemory(token);
      localStorage.setItem('refreshToken', refreshToken);
      persistContext(ctx);
      if (Array.isArray(list)) persistContexts(list);

      const cachedUser = localStorage.getItem('user') || '{"name":"User","email":""}';
      setUser(JSON.parse(cachedUser));

      localStorage.removeItem('tempUserId');
      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.response?.data?.error || 'Context selection failed',
      };
    }
  };

  // Switch the active unit (flat/plot/shop) while logged in.
  const switchContext = async (contextId: string) => {
    try {
      setIsLoading(true);
      const currentRefreshToken = localStorage.getItem('refreshToken');
      if (!currentRefreshToken) {
        throw new Error('No refresh token found');
      }

      const response = await api.post('/auth/refresh-token', {
        refreshToken: currentRefreshToken,
        contextId,
      });

      const { token, refreshToken: newRefreshToken, activeContext: ctx, availableContexts: list } = response.data;

      setAccessTokenInMemory(token);
      localStorage.setItem('refreshToken', newRefreshToken);
      persistContext(ctx);
      if (Array.isArray(list)) persistContexts(list);

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to switch workspace',
      };
    }
  };

  // Logout
  const logout = () => {
    setAccessTokenInMemory('');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('activeContext');
    localStorage.removeItem('activeContextId');
    localStorage.removeItem('activeProfile');
    localStorage.removeItem('availableContexts');
    localStorage.removeItem('user');
    localStorage.removeItem('tempUserId');
    localStorage.removeItem('employeePermissions');
    setUser(null);
    setActiveContext(null);
    setAvailableContexts([]);
    setEmployeePermissions(null);
    router.push('/login');
  };

  // Forgot Password
  const forgotPassword = async (email: string) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return { success: true, message: response.data.message };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Failed to send reset email',
      };
    }
  };

  // Reset Password
  const resetPassword = async (token: string, password: string) => {
    try {
      const response = await api.post('/auth/reset-password', { token, password });
      return { success: true, message: response.data.message };
    } catch (err: any) {
      return {
        success: false,
        error: err.response?.data?.error || err.response?.data?.errors?.[0]?.message || 'Failed to reset password',
      };
    }
  };

  // Update Current User (e.g., from Profile page)
  const updateCurrentUser = (userData: Partial<IUser>) => {
    if (user) {
      const updated = { ...user, ...userData };
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  };

  const isAuthenticated = !!user && !!activeContext;

  return (
    <AuthContext.Provider
      value={{
        user,
        activeProfile,
        activeContext,
        availableContexts,
        employeePermissions,
        isAuthenticated,
        isLoading,
        login,
        loginOtpRequest,
        loginOtpVerify,
        selectProfileContext,
        switchContext,
        logout,
        register,
        forgotPassword,
        resetPassword,
        updateCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
