'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { isAuthenticated, isLoading, activeProfile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && activeProfile && allowedRoles) {
      if (!allowedRoles.includes(activeProfile.role)) {
        // Not authorized for this page, redirect to main dashboard
        router.push('/dashboard?error=unauthorized');
      }
    }
  }, [isLoading, isAuthenticated, activeProfile, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07070a] flex flex-col items-center justify-center space-y-4">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-4 border-violet-500/20 animate-pulse" />
          <div className="absolute inset-0 rounded-full border-4 border-t-violet-500 border-r-transparent border-b-transparent border-l-transparent animate-spin" />
        </div>
        <p className="text-sm text-slate-400 font-medium tracking-wide animate-pulse">Loading Resismart Portal...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (activeProfile && allowedRoles && !allowedRoles.includes(activeProfile.role)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
