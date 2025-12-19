'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Modal } from '@/components/ui';
import PaperCard from '@/components/papers/PaperCard';
import { listPapers, createSession } from '@/lib/api';
import { Paper, Session } from '@/lib/types';
import { BookOpen, ArrowRight, CheckCircle } from 'lucide-react';
import clsx from 'clsx';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (session: Session) => void;
  preSelectedPaperId?: string;
}

export default function CreateSessionModal({
  isOpen,
  onClose,
  onCreated,
  preSelectedPaperId,
}: CreateSessionModalProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [selectedPapers, setSelectedPapers] = useState<string[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchPapers();
      // Pre-select paper if provided
      if (preSelectedPaperId) {
        setSelectedPapers([preSelectedPaperId]);
      }
    } else {
      // Reset on close
      setStep(1);
      setName('');
      setSelectedPapers([]);
      setError(null);
    }
  }, [isOpen, preSelectedPaperId]);

  const fetchPapers = async () => {
    try {
      setIsLoading(true);
      const data = await listPapers();
      // Only show completed papers
      setPapers(data.filter((p) => p.status === 'completed'));
    } catch (err) {
      setError('Failed to load papers');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePaper = (documentId: string) => {
    setSelectedPapers((prev) =>
      prev.includes(documentId)
        ? prev.filter((id) => id !== documentId)
        : [...prev, documentId]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Please enter a session name');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);
      const session = await createSession(name.trim(), selectedPapers);
      onCreated(session);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create session');
    } finally {
      setIsCreating(false);
    }
  };

  const steps = [
    { id: 1, label: 'Name your session' },
    { id: 2, label: 'Select papers' },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Study Session"
      description="Group papers together for focused Q&A"
      size="lg"
    >
      {/* Step indicator */}
      <div className="flex items-center gap-4 mb-6">
        {steps.map((s, index) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={clsx(
                'w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                step > s.id
                  ? 'bg-[var(--color-forest)] text-white'
                  : step === s.id
                  ? 'bg-[var(--color-forest)] text-white'
                  : 'bg-[var(--color-parchment)] text-[var(--color-stone)]'
              )}
            >
              {step > s.id ? <CheckCircle size={16} /> : s.id}
            </div>
            <span
              className={clsx(
                'text-sm',
                step >= s.id
                  ? 'text-[var(--color-ink)]'
                  : 'text-[var(--color-stone)]'
              )}
            >
              {s.label}
            </span>
            {index < steps.length - 1 && (
              <div
                className={clsx(
                  'w-12 h-0.5 mx-2',
                  step > s.id
                    ? 'bg-[var(--color-forest)]'
                    : 'bg-[var(--color-parchment)]'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)]/20 rounded-lg text-sm text-[var(--color-error)]">
          {error}
        </div>
      )}

      {/* Step 1: Name */}
      {step === 1 && (
        <div className="space-y-4">
          <Input
            label="Session Name"
            placeholder="e.g., Machine Learning Research"
            value={name}
            onChange={(e) => setName(e.target.value)}
            hint="Choose a descriptive name for your study session"
            autoFocus
          />

          <div className="flex justify-end gap-3 pt-4">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!name.trim()}
              rightIcon={<ArrowRight size={16} />}
            >
              Next: Select Papers
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Select papers */}
      {step === 2 && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-24 rounded-lg" />
              ))}
            </div>
          ) : papers.length === 0 ? (
            <div className="text-center py-8">
              <BookOpen
                size={32}
                className="mx-auto text-[var(--color-stone)] mb-3"
              />
              <p className="text-[var(--color-stone)]">
                No papers available. Upload papers to your library first.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[var(--color-stone)]">
                Select the papers you want to include in this session. You can
                add more later.
              </p>
              <div className="max-h-80 overflow-y-auto space-y-3 pr-2">
                {papers.map((paper) => (
                  <PaperCard
                    key={paper.document_id}
                    paper={paper}
                    selectable
                    isSelected={selectedPapers.includes(paper.document_id)}
                    onSelect={togglePaper}
                  />
                ))}
              </div>
              <p className="text-sm text-[var(--color-stone)]">
                {selectedPapers.length} paper
                {selectedPapers.length !== 1 ? 's' : ''} selected
              </p>
            </>
          )}

          <div className="flex justify-between gap-3 pt-4 border-t border-[var(--color-parchment)]">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                isLoading={isCreating}
                disabled={papers.length === 0}
              >
                Create Session
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Hint */}
      {step === 2 && selectedPapers.length === 0 && papers.length > 0 && (
        <p className="mt-4 text-xs text-[var(--color-amber)] italic">
          Tip: You can create an empty session and add papers later
        </p>
      )}
    </Modal>
  );
}

