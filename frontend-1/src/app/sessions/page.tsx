'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Plus, BookOpen, Loader2 } from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button, EmptyState } from '@/components/ui';
import SessionCard from '@/components/sessions/SessionCard';
import CreateSessionModal from '@/components/sessions/CreateSessionModal';
import { listSessions, deleteSession } from '@/lib/api';
import { Session } from '@/lib/types';

function SessionsContent() {
  const searchParams = useSearchParams();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [preSelectedPaperId, setPreSelectedPaperId] = useState<string | undefined>();

  // Check for addPaper query param
  useEffect(() => {
    const addPaper = searchParams.get('addPaper');
    if (addPaper) {
      setPreSelectedPaperId(addPaper);
      setShowCreateModal(true);
    }
  }, [searchParams]);

  const fetchSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listSessions();
      setSessions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDelete = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this session? Chat history will be lost.')) {
      return;
    }

    try {
      await deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId));
    } catch (err) {
      alert('Failed to delete session');
    }
  };

  const handleCreated = (session: Session) => {
    setSessions((prev) => [session, ...prev]);
    // Clear the query param
    window.history.replaceState({}, '', '/sessions');
    setPreSelectedPaperId(undefined);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setPreSelectedPaperId(undefined);
    // Clear the query param
    window.history.replaceState({}, '', '/sessions');
  };

  // Sort sessions by last_active
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(b.last_active).getTime() - new Date(a.last_active).getTime()
  );

  return (
    <div className="min-h-screen">
      <Header
        title="Study Sessions"
        description="Create focused study sessions to chat with your papers"
        actions={
          <Button
            onClick={() => setShowCreateModal(true)}
            leftIcon={<Plus size={18} />}
          >
            New Session
          </Button>
        }
      />

      <div className="p-8 bg-white">
        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-lg text-[var(--color-error)]">
            {error}
            <button
              onClick={fetchSessions}
              className="ml-2 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && sessions.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[var(--color-parchment)] p-5"
              >
                <div className="skeleton w-12 h-12 rounded-lg mb-4" />
                <div className="skeleton h-6 w-3/4 rounded mb-2" />
                <div className="skeleton h-4 w-1/2 rounded mb-4" />
                <div className="skeleton h-3 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && sessions.length === 0 && (
          <EmptyState
            icon={<BookOpen size={32} />}
            title="No study sessions yet"
            description="Create your first study session to start chatting with your research papers. Group related papers together for focused Q&A."
            action={{
              label: 'Create Your First Session',
              onClick: () => setShowCreateModal(true),
              icon: <Plus size={18} />,
            }}
            hint="Sessions let you ask questions across multiple papers at once"
          />
        )}

        {/* Sessions grid */}
        {sortedSessions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {sortedSessions.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Workflow hint */}
        {sessions.length > 0 && (
          <div className="mt-8 p-4 bg-[var(--color-parchment)]/50 rounded-lg border border-[var(--color-sand)]">
            <p className="text-sm text-[var(--color-slate)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-amber)]" />
              <span className="font-medium">Tip:</span>
              Click on a session to open the chat interface and start asking questions.
            </p>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateSessionModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        onCreated={handleCreated}
        preSelectedPaperId={preSelectedPaperId}
      />
    </div>
  );
}

export default function SessionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={48} className="animate-spin text-[var(--color-forest)]" />
      </div>
    }>
      <SessionsContent />
    </Suspense>
  );
}
