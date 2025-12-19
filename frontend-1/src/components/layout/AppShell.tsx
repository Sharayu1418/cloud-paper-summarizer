'use client';

import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

interface AppShellProps {
  children: React.ReactNode;
}

// Routes that should NOT show the sidebar (auth pages)
const authRoutes = [
  '/login',
  '/signup',
  '/signup/confirm',
  '/auth/callback',
  '/forgot-password',
  '/reset-password',
];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  
  const isAuthRoute = authRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + '/')
  );

  // Auth pages get their own layout (no sidebar)
  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Main app layout with sidebar and protection
  return (
    <ProtectedRoute>
      <div className="flex min-h-screen bg-[var(--color-ivory)]">
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </ProtectedRoute>
  );
}

