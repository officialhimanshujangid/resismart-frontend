'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../context/AuthContext';
import BrandLoader from '../common/BrandLoader';

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
    return <BrandLoader label="Loading Resismart Portal…" />;
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
