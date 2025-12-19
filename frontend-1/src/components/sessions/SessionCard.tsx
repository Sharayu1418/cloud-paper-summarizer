'use client';

import { BookOpen, FileText, Clock, MessageSquare, MoreVertical, Trash2, Edit } from 'lucide-react';
import { Session } from '@/lib/types';
import Link from 'next/link';
import { useState } from 'react';
import clsx from 'clsx';

interface SessionCardProps {
  session: Session;
  onDelete?: (sessionId: string) => void;
  onEdit?: (session: Session) => void;
}

export default function SessionCard({
  session,
  onDelete,
  onEdit,
}: SessionCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const paperCount = session.paper_ids?.length || 0;

  return (
    <div className="bg-white rounded-xl border border-[var(--color-parchment)] p-5 card-hover group relative">
      {/* Menu button */}
      {(onDelete || onEdit) && (
        <div className="absolute top-4 right-4">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="p-1.5 rounded-lg text-[var(--color-stone)] hover:bg-[var(--color-parchment)] hover:text-[var(--color-ink)] transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute right-0 top-8 z-20 w-40 bg-white rounded-lg shadow-lg border border-[var(--color-parchment)] py-1">
                {onEdit && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onEdit(session);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[var(--color-ink)] hover:bg-[var(--color-parchment)] flex items-center gap-2"
                  >
                    <Edit size={14} />
                    Rename
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onDelete(session.session_id);
                      setShowMenu(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-[var(--color-error)] hover:bg-[var(--color-error)]/5 flex items-center gap-2"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      <Link href={`/sessions/${session.session_id}`} className="block">
        {/* Icon */}
        <div className="w-12 h-12 rounded-lg bg-[var(--color-forest)]/10 flex items-center justify-center text-[var(--color-forest)] mb-4 group-hover:bg-[var(--color-forest)] group-hover:text-white transition-colors">
          <BookOpen size={24} />
        </div>

        {/* Title */}
        <h3 className="font-serif font-bold text-lg text-[var(--color-ink)] mb-2 pr-8">
          {session.name}
        </h3>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-[var(--color-stone)] mb-4">
          <span className="flex items-center gap-1.5">
            <FileText size={14} />
            {paperCount} {paperCount === 1 ? 'paper' : 'papers'}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={14} />
            {formatDate(session.last_active)}
          </span>
        </div>

        {/* Papers preview */}
        {session.papers && session.papers.length > 0 && (
          <div className="space-y-1.5 pt-3 border-t border-[var(--color-parchment)]">
            {session.papers.slice(0, 2).map((paper) => (
              <p
                key={paper.document_id}
                className="text-xs text-[var(--color-stone)] truncate"
              >
                • {paper.title}
              </p>
            ))}
            {session.papers.length > 2 && (
              <p className="text-xs text-[var(--color-stone)]">
                +{session.papers.length - 2} more
              </p>
            )}
          </div>
        )}

        {/* Empty state hint */}
        {paperCount === 0 && (
          <p className="text-xs text-[var(--color-amber)] italic pt-3 border-t border-[var(--color-parchment)]">
            Add papers to start chatting
          </p>
        )}

        {/* Hover CTA */}
        <div className="mt-4 pt-3 border-t border-[var(--color-parchment)] opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-sm text-[var(--color-forest)] font-medium flex items-center gap-1">
            <MessageSquare size={14} />
            Open Chat →
          </span>
        </div>
      </Link>
    </div>
  );
}

