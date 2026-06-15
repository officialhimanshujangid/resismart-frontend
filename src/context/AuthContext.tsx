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
}

interface AuthContextType {
  user: IUser | null;
  activeProfile: IUserProfile | null;
  availableProfiles: IUserProfile[];
  employeePermissions: IModulePermission[] | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; requiresContextSelection?: boolean; error?: string }>;
  selectProfileContext: (tenantId: string, role: string, userId: string) => Promise<{ success: boolean; error?: string }>;
  switchProfileContext: (tenantId: string, role: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  register: (name: string, email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  forgotPassword: (email: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  resetPassword: (token: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<IUser | null>(null);
  const [activeProfile, setActiveProfile] = useState<IUserProfile | null>(null);
  const [availableProfiles, setAvailableProfiles] = useState<IUserProfile[]>([]);
  const [employeePermissions, setEmployeePermissions] = useState<IModulePermission[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useNextRouter();
  const pathname = usePathname();

  // Handle initial session validation
  useEffect(() => {
    const initializeAuth = async () => {
      const localRefreshToken = localStorage.getItem('refreshToken');
      const savedProfile = localStorage.getItem('activeProfile');
      const savedUser = localStorage.getItem('user');

      if (!localRefreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        let tenantId = undefined;
        let role = undefined;

        if (savedProfile) {
          try {
            const parsed = JSON.parse(savedProfile);
            tenantId = parsed.tenantId;
            role = parsed.role;
          } catch (_) {}
        }

        // Hit refresh endpoint to get active session
        const response = await api.post('/auth/refresh-token', {
          refreshToken: localRefreshToken,
          tenantId,
          role,
        });

        const { token, refreshToken: newRefreshToken, profile } = response.data;
        
        setAccessTokenInMemory(token);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        if (savedUser) {
          setUser(JSON.parse(savedUser));
        }
        
        if (profile) {
          setActiveProfile(profile);
          localStorage.setItem('activeProfile', JSON.stringify(profile));

          // Load employee permissions if SYSTEM_EMPLOYEE
          if (profile.role === 'SYSTEM_EMPLOYEE') {
            try {
              const permRes = await api.get('/system-employees/me/permissions');
              const perms: IModulePermission[] = permRes.data.permissions ?? [];
              setEmployeePermissions(perms);
              localStorage.setItem('employeePermissions', JSON.stringify(perms));
            } catch (_) {
              setEmployeePermissions([]);
            }
          }
        }

      } catch (err) {
        console.error('Session auto-login failed:', err);
        // Clear auth data
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('activeProfile');
        localStorage.removeItem('user');
        setUser(null);
        setActiveProfile(null);
      } finally {
        // Recover temp profiles if any
        const savedProfilesList = localStorage.getItem('availableProfiles');
        if (savedProfilesList) {
          try { setAvailableProfiles(JSON.parse(savedProfilesList)); } catch (_) {}
        }
        // Recover cached employee permissions
        const savedPerms = localStorage.getItem('employeePermissions');
        if (savedPerms) {
          try { setEmployeePermissions(JSON.parse(savedPerms)); } catch (_) {}
        }
        setIsLoading(false);
      }
    };

    initializeAuth();

    // Listen for axios refresh failure logs
    const handleForceLogout = () => {
      setUser(null);
      setActiveProfile(null);
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

  // Login
  const login = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/login', { email, password });
      
      const data = response.data;

      if (data.requiresContextSelection) {
        setAvailableProfiles(data.profiles);
        // Cache profiles and userId temporarily in localStorage for selectContext page
        localStorage.setItem('tempUserId', data.userId);
        localStorage.setItem('availableProfiles', JSON.stringify(data.profiles));
        
        // Save user details temporarily so we have them after context select
        localStorage.setItem('user', JSON.stringify({ name: email.split('@')[0], email }));
        
        setIsLoading(false);
        return { success: true, requiresContextSelection: true };
      }

      // Auto-selected exactly 1 context
      const { token, refreshToken, profile, user: loggedUser } = data;
      
      setAccessTokenInMemory(token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(loggedUser));
      localStorage.setItem('activeProfile', JSON.stringify(profile));
      
      setUser(loggedUser);
      setActiveProfile(profile);

      // Fetch employee permissions if SYSTEM_EMPLOYEE
      if (profile.role === 'SYSTEM_EMPLOYEE') {
        try {
          const permRes = await api.get('/system-employees/me/permissions');
          const perms: IModulePermission[] = permRes.data.permissions ?? [];
          setEmployeePermissions(perms);
          localStorage.setItem('employeePermissions', JSON.stringify(perms));
        } catch (_) {
          setEmployeePermissions([]);
        }
      }

      setIsLoading(false);
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.response?.data?.error || 'Invalid credentials',
      };
    }
  };

  // Select Profile Context
  const selectProfileContext = async (tenantId: string, role: string, userId: string) => {
    try {
      setIsLoading(true);
      const response = await api.post('/auth/select-context', {
        tenantId,
        role,
        userId,
      });

      const { token, refreshToken, profile } = response.data;
      
      setAccessTokenInMemory(token);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('activeProfile', JSON.stringify(profile));

      // Fetch user profile name (we can pull from temporary storage, or query a profile endpoint.
      // Since login gave us the user email, let's keep user cached)
      const cachedUser = localStorage.getItem('user') || '{"name":"User","email":""}';
      const userObj = JSON.parse(cachedUser);
      setUser(userObj);
      localStorage.setItem('user', JSON.stringify(userObj));
      
      setActiveProfile(profile);
      localStorage.removeItem('tempUserId');
      localStorage.removeItem('availableProfiles');
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

  // Switch context profile dynamically while logged in
  const switchProfileContext = async (tenantId: string, role: string) => {
    try {
      setIsLoading(true);
      const currentRefreshToken = localStorage.getItem('refreshToken');
      
      if (!currentRefreshToken) {
        throw new Error('No refresh token found');
      }

      const response = await api.post('/auth/refresh-token', {
        refreshToken: currentRefreshToken,
        tenantId,
        role,
      });

      const { token, refreshToken: newRefreshToken, profile } = response.data;
      
      setAccessTokenInMemory(token);
      localStorage.setItem('refreshToken', newRefreshToken);
      localStorage.setItem('activeProfile', JSON.stringify(profile));
      
      setActiveProfile(profile);
      setIsLoading(false);
      
      return { success: true };
    } catch (err: any) {
      setIsLoading(false);
      return {
        success: false,
        error: err.response?.data?.error || 'Failed to switch profile context',
      };
    }
  };

  // Logout
  const logout = () => {
    setAccessTokenInMemory('');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('activeProfile');
    localStorage.removeItem('user');
    localStorage.removeItem('tempUserId');
    localStorage.removeItem('availableProfiles');
    localStorage.removeItem('employeePermissions');
    setUser(null);
    setActiveProfile(null);
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

  const isAuthenticated = !!user && !!activeProfile;

  return (
    <AuthContext.Provider
      value={{
        user,
        activeProfile,
        availableProfiles,
        employeePermissions,
        isAuthenticated,
        isLoading,
        login,
        selectProfileContext,
        switchProfileContext,
        logout,
        register,
        forgotPassword,
        resetPassword,
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
