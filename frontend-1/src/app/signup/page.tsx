'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Mail, Lock, User, Loader2, AlertCircle } from 'lucide-react';
import { signUp, getGoogleSignInUrl } from '@/lib/auth';

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signUp({ email, password, name });
      
      if (!result.userConfirmed) {
        // Need to confirm email
        router.push(`/signup/confirm?email=${encodeURIComponent(email)}`);
      } else {
        // Auto-confirmed, redirect to login
        router.push('/login');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = () => {
    window.location.href = getGoogleSignInUrl();
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
          <h1 className="text-2xl font-serif font-bold text-[var(--color-ink)] text-center mb-2">
            Create your account
          </h1>
          <p className="text-[var(--color-stone)] text-center mb-6">
            Start your research journey
          </p>

          {/* Error */}
          {error && (
            <div className="mb-6 p-4 rounded-lg bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 flex items-start gap-3">
              <AlertCircle size={20} className="text-[var(--color-error)] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[var(--color-error)]">{error}</p>
            </div>
          )}

          {/* Google Sign Up */}
          <button
            onClick={handleGoogleSignUp}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-[var(--color-parchment)] rounded-lg hover:bg-[var(--color-ivory)] transition-colors mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium text-[var(--color-ink)]">Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-[var(--color-parchment)]" />
            <span className="text-sm text-[var(--color-stone)]">or</span>
            <div className="flex-1 h-px bg-[var(--color-parchment)]" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1.5">
                Name
              </label>
              <div className="relative">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-stone)]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--color-parchment)] focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-stone)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--color-parchment)] focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20 outline-none transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-slate)] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-stone)]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-[var(--color-parchment)] focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20 outline-none transition-colors"
                />
              </div>
              <p className="mt-1.5 text-xs text-[var(--color-stone)]">
                Must be at least 8 characters
              </p>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-[var(--color-forest)] text-white font-medium rounded-lg hover:bg-[var(--color-forest-light)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-[var(--color-stone)]">
            Already have an account?{' '}
            <Link href="/login" className="text-[var(--color-forest)] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
