'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Grid, List, RefreshCw, Library as LibraryIcon, ArrowRight } from 'lucide-react';
import Header from '@/components/layout/Header';
import { Button, Modal, EmptyState } from '@/components/ui';
import PaperCard from '@/components/papers/PaperCard';
import PaperUpload from '@/components/papers/PaperUpload';
import { listPapers, deletePaper } from '@/lib/api';
import { Paper } from '@/lib/types';
import Link from 'next/link';
import clsx from 'clsx';

export default function LibraryPage() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchPapers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await listPapers();
      setPapers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load papers');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPapers();
  }, [fetchPapers]);

  // Auto-refresh for processing papers
  useEffect(() => {
    const hasProcessing = papers.some(
      (p) => p.status === 'pending' || p.status === 'processing'
    );

    if (hasProcessing) {
      const interval = setInterval(fetchPapers, 10000); // Refresh every 10s
      return () => clearInterval(interval);
    }
  }, [papers, fetchPapers]);

  const handleUploadComplete = () => {
    fetchPapers();
  };

  const handleDeletePaper = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this paper?')) {
      return;
    }
    try {
      await deletePaper(documentId);
      // Remove from local state immediately
      setPapers((prev) => prev.filter((p) => p.document_id !== documentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete paper');
    }
  };

  const completedPapers = papers.filter((p) => p.status === 'completed');
  const processingPapers = papers.filter(
    (p) => p.status === 'pending' || p.status === 'processing'
  );

  return (
    <div className="min-h-screen">
      <Header
        title="Library"
        description="Upload and manage your research papers"
        actions={
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-[var(--color-parchment)] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={clsx(
                  'p-2 rounded-md transition-colors',
                  viewMode === 'grid'
                    ? 'bg-white text-[var(--color-ink)] shadow-sm'
                    : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'
                )}
                aria-label="Grid view"
              >
                <Grid size={18} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={clsx(
                  'p-2 rounded-md transition-colors',
                  viewMode === 'list'
                    ? 'bg-white text-[var(--color-ink)] shadow-sm'
                    : 'text-[var(--color-stone)] hover:text-[var(--color-ink)]'
                )}
                aria-label="List view"
              >
                <List size={18} />
              </button>
            </div>

            {/* Refresh button */}
            <Button
              variant="ghost"
              onClick={fetchPapers}
              disabled={isLoading}
              aria-label="Refresh papers"
            >
              <RefreshCw
                size={18}
                className={clsx(isLoading && 'animate-spin')}
              />
            </Button>

            {/* Upload button */}
            <Button
              onClick={() => setShowUploadModal(true)}
              leftIcon={<Plus size={18} />}
            >
              Upload Paper
            </Button>
          </div>
        }
      />

      <div className="p-8 bg-white">
        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-lg text-[var(--color-error)]">
            {error}
            <button
              onClick={fetchPapers}
              className="ml-2 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Loading state */}
        {isLoading && papers.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-[var(--color-parchment)] p-5"
              >
                <div className="skeleton w-10 h-10 rounded-lg mb-4" />
                <div className="skeleton h-5 w-3/4 rounded mb-2" />
                <div className="skeleton h-4 w-1/2 rounded mb-4" />
                <div className="skeleton h-3 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && papers.length === 0 && (
          <EmptyState
            icon={<LibraryIcon size={32} />}
            title="Your library is empty"
            description="Upload your first research paper to get started. We'll extract the text and prepare it for intelligent Q&A."
            action={{
              label: 'Upload Your First Paper',
              onClick: () => setShowUploadModal(true),
              icon: <Plus size={18} />,
            }}
            hint="Supported format: PDF (max 50MB)"
          />
        )}

        {/* Processing papers section */}
        {processingPapers.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <RefreshCw
                size={16}
                className="text-[var(--color-info)] animate-spin"
              />
              <h2 className="font-medium text-[var(--color-ink)]">
                Processing ({processingPapers.length})
              </h2>
            </div>
            <div
              className={clsx(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                  : 'space-y-3'
              )}
            >
              {processingPapers.map((paper) => (
                <PaperCard 
                  key={paper.document_id} 
                  paper={paper} 
                  onDelete={handleDeletePaper}
                />
              ))}
            </div>
          </div>
        )}

        {/* Completed papers section */}
        {completedPapers.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-medium text-[var(--color-ink)]">
                Ready to Use ({completedPapers.length})
              </h2>
              {completedPapers.length > 0 && (
                <Link
                  href="/sessions"
                  className="text-sm text-[var(--color-forest)] hover:text-[var(--color-forest-light)] flex items-center gap-1 transition-colors"
                >
                  Create a study session
                  <ArrowRight size={14} />
                </Link>
              )}
            </div>
            <div
              className={clsx(
                viewMode === 'grid'
                  ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children'
                  : 'space-y-3 stagger-children'
              )}
            >
              {completedPapers.map((paper) => (
                <PaperCard
                  key={paper.document_id}
                  paper={paper}
                  onDelete={handleDeletePaper}
                  onAddToSession={(id) => {
                    // Navigate to sessions with paper pre-selected
                    window.location.href = `/sessions?addPaper=${id}`;
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Next step hint */}
        {completedPapers.length > 0 && (
          <div className="mt-8 p-4 bg-[var(--color-parchment)]/50 rounded-lg border border-[var(--color-sand)]">
            <p className="text-sm text-[var(--color-slate)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--color-forest)]" />
              <span className="font-medium">Next step:</span>
              Create a Study Session to start chatting with your papers.
              <Link
                href="/sessions"
                className="text-[var(--color-forest)] hover:underline font-medium ml-1"
              >
                Go to Sessions →
              </Link>
            </p>
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload Research Papers"
        description="Add PDFs to your library for AI-powered analysis"
        size="lg"
      >
        <PaperUpload onUploadComplete={handleUploadComplete} />
        <div className="mt-6 pt-4 border-t border-[var(--color-parchment)] flex justify-end">
          <Button variant="secondary" onClick={() => setShowUploadModal(false)}>
            Done
          </Button>
        </div>
      </Modal>
    </div>
  );
}

