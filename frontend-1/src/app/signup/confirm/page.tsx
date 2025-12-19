'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Mail, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { confirmSignUp, resendConfirmationCode } from '@/lib/auth';

function ConfirmContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailFromQuery = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromQuery);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await confirmSignUp({ email, code });
      router.push('/login?confirmed=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setError(null);
    setResendSuccess(false);
    setIsResending(true);

    try {
      await resendConfirmationCode(email);
      setResendSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)] p-8">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-forest)] flex items-center justify-center text-white">
            <BookOpen size={28} />
          </div>
          <span className="text-3xl font-serif font-bold text-[var(--color-ink)]">Scholar</span>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg border border-[var(--color-parchment)] p-8">
          <div className="w-16 h-16 rounded-full bg-[var(--color-forest)]/10 flex items-center justify-center mx-auto mb-6">
            <Mail size={32} className="text-[var(--color-forest)]" />
          </div>

          <h1 className="text-2xl font-serif font-bold text-[var(--color-ink)] text-center mb-2">
            Check your email
          </h1>
          <p className="text-[var(--color-stone)] text-center mb-6">
            We sent a verification code to your email.
            Enter it below to confirm your account.
          </p>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-start gap-3">
              <AlertCircle size={20} className="text-[var(--color-error)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          {/* Success */}
          {resendSuccess && (
            <div className="mb-6 p-4 rounded-lg bg-[var(--color-success)]/10 border border-[var(--color-success)]/20 flex items-start gap-3">
              <CheckCircle size={20} className="text-[var(--color-success)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--color-success)]">Code resent successfully!</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-parchment)] focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1.5">
                Verification Code
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                maxLength={6}
                className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-parchment)] focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20 outline-none transition-colors text-center text-2xl tracking-widest"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--color-forest)] text-white font-medium rounded-lg hover:bg-[var(--color-forest-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          {/* Resend */}
          <div className="mt-6 text-center">
            <p className="text-sm text-[var(--color-stone)]">
              Didn't receive the code?{' '}
              <button
                onClick={handleResend}
                disabled={isResending}
                className="text-[var(--color-forest)] font-medium hover:underline disabled:opacity-50"
              >
                {isResending ? 'Resending...' : 'Resend code'}
              </button>
            </p>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-[var(--color-stone)]">
            <Link href="/login" className="text-[var(--color-forest)] font-medium hover:underline">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[var(--color-ivory)]">
        <Loader2 size={48} className="animate-spin text-[var(--color-forest)]" />
      </div>
    }>
      <ConfirmContent />
    </Suspense>
  );
}
