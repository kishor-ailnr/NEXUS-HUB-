import React from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { isValidOrgMode, OrgMode } from '@nexus-ways/shared';
import { useAuthStore } from '../store/authStore';
import { PageLoadingSkeleton } from './PageLoadingSkeleton';
import { NotFound } from '../pages/NotFound';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { mode } = useParams<{ mode: string }>();
  const { user, isAuthenticated, isLoading } = useAuthStore();
  const location = useLocation();

  if (mode && !isValidOrgMode(mode)) {
    return <NotFound />;
  }

  const currentMode = (mode || 'roadways') as OrgMode;

  if (isLoading) {
    return <PageLoadingSkeleton />;
  }

  if (!isAuthenticated) {
    return <Navigate to={`/${currentMode}/login`} state={{ from: location }} replace />;
  }

  // Frontend Mode Isolation: Check that user's org mode matches the requested route mode
  if (user && user.organization.mode !== currentMode) {
    return <Navigate to={`/${currentMode}/login`} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
