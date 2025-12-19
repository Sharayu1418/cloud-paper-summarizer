'use client';

import { Fragment, ReactNode } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className={clsx(
            `w-full bg-white rounded-xl shadow-xl
            transform transition-all duration-300
            animate-fade-in`,
            sizes[size]
          )}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {/* Header */}
          {(title || description) && (
            <div className="px-6 pt-6 pb-4 border-b border-[var(--color-parchment)]">
              <div className="flex items-start justify-between">
                <div>
                  {title && (
                    <h2
                      id="modal-title"
                      className="text-xl font-serif font-bold text-[var(--color-ink)]"
                    >
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="mt-1 text-sm text-[var(--color-stone)]">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-[var(--color-stone)] hover:text-[var(--color-ink)] hover:bg-[var(--color-parchment)] transition-colors"
                  aria-label="Close modal"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-4">{children}</div>
        </div>
      </div>
    </Fragment>
  );
}

