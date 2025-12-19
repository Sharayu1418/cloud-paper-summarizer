'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, AlertCircle, BookOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleCallback } = useAuth();
  
  const [error, setError] = useState<string | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    // Prevent double-execution in React StrictMode
    if (processedRef.current) return;

    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (errorParam) {
      setError(errorDescription || errorParam || 'Authentication failed');
      return;
    }

    if (!code) {
      setError('No authorization code received');
      return;
    }

    // Mark as processed
    processedRef.current = true;

    // Exchange code for tokens
    handleCallback(code)
      .then(() => {
        router.push('/');
      })
      .catch((err) => {
        setError(err.message || 'Failed to complete authentication');
        processedRef.current = false; // Allow retry on error
      });
  }, [searchParams, handleCallback, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)] p-8">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-error)]/10 flex items-center justify-center mx-auto mb-6">
            <AlertCircle size={32} className="text-[var(--color-error)]" />
          </div>
          <h2 className="text-2xl font-serif font-bold text-[var(--color-ink)] mb-2">
            Authentication Failed
          </h2>
          <p className="text-[var(--color-stone)] mb-6">{error}</p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-2 bg-[var(--color-forest)] text-white rounded-lg hover:bg-[var(--color-forest-light)] transition-colors"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)] p-8">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-forest)] flex items-center justify-center text-white">
            <BookOpen size={24} />
          </div>
          <span className="text-2xl font-serif font-bold text-[var(--color-ink)]">Scholar</span>
        </div>
        
        <Loader2 size={48} className="animate-spin text-[var(--color-forest)] mx-auto mb-6" />
        
        <h2 className="text-xl font-serif font-bold text-[var(--color-ink)] mb-2">
          Completing sign in...
        </h2>
        <p className="text-[var(--color-stone)]">
          Please wait while we verify your credentials
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)]">
        <Loader2 size={48} className="animate-spin text-[var(--color-forest)]" />
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
