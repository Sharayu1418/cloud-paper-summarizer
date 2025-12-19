'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

// Routes that don't require authentication
const publicRoutes = [
  '/login',
  '/signup',
  '/signup/confirm',
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
];

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();

  const isPublicRoute = publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  useEffect(() => {
    if (!isLoading) {
      // Redirect unauthenticated users to login (except on public routes)
      if (!isAuthenticated && !isPublicRoute) {
        router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      }
      
      // Redirect authenticated users away from auth pages
      if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
        router.push('/');
      }
    }
  }, [isAuthenticated, isLoading, isPublicRoute, pathname, router]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)]">
        <Loader2 size={32} className="animate-spin text-[var(--color-forest)]" />
      </div>
    );
  }

  // Show nothing while redirecting
  if (!isAuthenticated && !isPublicRoute) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)]">
        <Loader2 size={32} className="animate-spin text-[var(--color-forest)]" />
      </div>
    );
  }

  return <>{children}</>;
}

