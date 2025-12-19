'use client';

import { FileText, User, MoreVertical, Trash2, Plus } from 'lucide-react';
import { Paper } from '@/lib/types';
import { StatusBadge } from '@/components/ui';
import clsx from 'clsx';
import { useState, useEffect, useRef } from 'react';

interface PaperCardProps {
  paper: Paper;
  onDelete?: (documentId: string) => void;
  onAddToSession?: (documentId: string) => void;
  isSelected?: boolean;
  onSelect?: (documentId: string) => void;
  selectable?: boolean;
}

export default function PaperCard({
  paper,
  onDelete,
  onAddToSession,
  isSelected,
  onSelect,
  selectable = false,
}: PaperCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);


  return (
    <div
      className={clsx(
        'bg-white rounded-xl border p-5 card-hover relative group',
        isSelected
          ? 'border-[var(--color-forest)] ring-2 ring-[var(--color-forest)]/20'
          : 'border-[var(--color-parchment)]',
        selectable && 'cursor-pointer'
      )}
      onClick={() => selectable && onSelect?.(paper.document_id)}
    >
      {/* Selection indicator */}
      {selectable && (
        <div
          className={clsx(
            'absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all',
            isSelected
              ? 'bg-[var(--color-forest)] border-[var(--color-forest)]'
              : 'border-[var(--color-sand)] group-hover:border-[var(--color-stone)]'
          )}
        >
          {isSelected && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </div>
      )}

      {/* Menu button (non-selectable mode) */}
      {!selectable && (onDelete || onAddToSession) && (
        <div className="absolute top-4 right-4" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg text-[var(--color-stone)] hover:bg-[var(--color-parchment)] hover:text-[var(--color-ink)] transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div className="absolute right-0 top-8 z-20 w-48 bg-white rounded-lg shadow-lg border border-[var(--color-parchment)] py-1">
              {onAddToSession && paper.status === 'completed' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddToSession(paper.document_id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-parchment)] flex items-center gap-2"
                >
                  <Plus size={14} />
                  Add to Session
                </button>
              )}
              {onDelete && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(paper.document_id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-error)]/5 flex items-center gap-2"
                >
                  <Trash2 size={14} />
                  Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Icon */}
      <div className="w-10 h-10 rounded-lg bg-[var(--color-parchment)] flex items-center justify-center text-[var(--color-forest)] mb-4">
        <FileText size={20} />
      </div>

      {/* Title */}
      <h3 className="font-serif font-bold text-[var(--color-ink)] mb-2 line-clamp-2 pr-8">
        {paper.title}
      </h3>

      {/* Authors */}
      <div className="flex items-center gap-2 text-sm text-[var(--color-stone)] mb-3">
        <User size={14} />
        <span className="line-clamp-1">{paper.authors}</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end pt-3 border-t border-[var(--color-parchment)]">
        <StatusBadge status={paper.status} size="sm" />
      </div>

      {/* Processing hint */}
      {paper.status === 'processing' && (
        <p className="mt-3 text-xs text-[var(--color-info)] italic">
          Extracting text and generating embeddings...
        </p>
      )}

      {/* Ready hint */}
      {paper.status === 'completed' && (
        <p className="mt-3 text-xs text-[var(--color-success)] italic opacity-0 group-hover:opacity-100 transition-opacity">
          Ready for study sessions
        </p>
      )}
    </div>
  );
}