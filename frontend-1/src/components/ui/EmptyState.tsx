'use client';

import { ReactNode } from 'react';
import Button from './Button';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  hint?: string;
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  hint,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-parchment)] flex items-center justify-center text-[var(--color-forest)] mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-serif font-bold text-[var(--color-ink)] mb-2">
        {title}
      </h3>
      <p className="text-[var(--color-stone)] max-w-sm mb-6">{description}</p>
      {action && (
        <Button
          onClick={action.onClick}
          leftIcon={action.icon}
          className="pulse-cta"
        >
          {action.label}
        </Button>
      )}
      {hint && (
        <p className="mt-6 text-sm text-[var(--color-stone)] italic flex items-center gap-2">
          <span className="inline-block w-1 h-1 rounded-full bg-[var(--color-amber)]" />
          {hint}
        </p>
      )}
    </div>
  );
}

