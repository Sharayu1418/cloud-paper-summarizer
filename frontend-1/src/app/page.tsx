'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    
    if (isAuthenticated) {
      // Authenticated users go to library
      router.replace('/library');
    } else {
      // Unauthenticated users go to signup
      router.replace('/signup');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show loading spinner while checking auth or redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)]">
      <div className="text-center">
        <div className="w-12 h-12 rounded-full border-4 border-[var(--color-parchment)] border-t-[var(--color-forest)] animate-spin mx-auto mb-4" />
        <p className="text-[var(--color-stone)]">Loading...</p>
      </div>
    </div>
  );
}
