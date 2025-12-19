'use client';

import clsx from 'clsx';
import { CheckCircle, Clock, Loader2, AlertCircle } from 'lucide-react';

interface StatusBadgeProps {
  status: 'pending' | 'processing' | 'completed' | 'failed' | string;
  showIcon?: boolean;
  size?: 'sm' | 'md';
}

export default function StatusBadge({
  status,
  showIcon = true,
  size = 'md',
}: StatusBadgeProps) {
  const config = {
    pending: {
      label: 'Pending',
      icon: Clock,
      className: 'bg-[var(--color-sand)]/50 text-[var(--color-slate)]',
    },
    processing: {
      label: 'Processing',
      icon: Loader2,
      className: 'bg-[var(--color-info)]/10 text-[var(--color-info)]',
      animate: true,
    },
    completed: {
      label: 'Ready',
      icon: CheckCircle,
      className: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    },
    failed: {
      label: 'Failed',
      icon: AlertCircle,
      className: 'bg-[var(--color-error)]/10 text-[var(--color-error)]',
    },
  };

  const statusConfig = config[status as keyof typeof config] || config.pending;
  const Icon = statusConfig.icon;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        statusConfig.className,
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      )}
    >
      {showIcon && (
        <Icon
          size={size === 'sm' ? 12 : 14}
          className={clsx('animate' in statusConfig && statusConfig.animate && 'animate-spin')}
        />
      )}
      {statusConfig.label}
    </span>
  );
}

