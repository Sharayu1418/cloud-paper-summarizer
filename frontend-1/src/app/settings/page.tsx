'use client';

import { useState, useEffect } from 'react';
import { User, Key, Save, CheckCircle } from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button, Input } from '@/components/ui';
import { getCurrentUserId, setUserId } from '@/lib/api';

export default function SettingsPage() {
  const [userId, setUserIdState] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUserIdState(getCurrentUserId());
  }, []);

  const handleSave = () => {
    if (userId.trim()) {
      setUserId(userId.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="min-h-screen">
      <Header
        title="Settings"
        description="Configure your research assistant"
      />

      <div className="p-8 max-w-2xl">
        {/* User ID Section */}
        <div className="bg-white rounded-xl border border-[var(--color-parchment)] p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-forest)]/10 flex items-center justify-center text-[var(--color-forest)]">
              <User size={20} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-[var(--color-ink)]">
                User Identity
              </h2>
              <p className="text-sm text-[var(--color-stone)]">
                Your unique identifier for storing papers and sessions
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="User ID"
              value={userId}
              onChange={(e) => setUserIdState(e.target.value)}
              placeholder="Enter your user ID"
              hint="This ID is used to associate your papers and sessions. In production, this would come from authentication."
            />

            <div className="flex items-center gap-3">
              <Button onClick={handleSave} leftIcon={<Save size={16} />}>
                Save
              </Button>
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-[var(--color-success)]">
                  <CheckCircle size={16} />
                  Saved!
                </span>
              )}
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="bg-white rounded-xl border border-[var(--color-parchment)] p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-forest)]/10 flex items-center justify-center text-[var(--color-forest)]">
              <Key size={20} />
            </div>
            <div>
              <h2 className="font-serif font-bold text-lg text-[var(--color-ink)]">
                API Configuration
              </h2>
              <p className="text-sm text-[var(--color-stone)]">
                Backend API endpoint
              </p>
            </div>
          </div>

          <div className="p-4 bg-[var(--color-cream)] rounded-lg">
            <p className="text-sm font-mono text-[var(--color-slate)] break-all">
              {process.env.NEXT_PUBLIC_API_URL || 'Not configured'}
            </p>
          </div>

          <p className="mt-3 text-xs text-[var(--color-stone)]">
            API URL is configured via environment variables. Update{' '}
            <code className="px-1.5 py-0.5 bg-[var(--color-parchment)] rounded text-[var(--color-forest)]">
              .env.local
            </code>{' '}
            to change.
          </p>
        </div>

        {/* About */}
        <div className="mt-8 text-center text-sm text-[var(--color-stone)]">
          <p>Research Paper RAG System</p>
          <p className="mt-1">
            Built with Next.js, AWS Lambda, and AI-powered document analysis
          </p>
        </div>
      </div>
    </div>
  );
}

