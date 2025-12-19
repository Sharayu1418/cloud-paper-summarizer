'use client';

import { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface HeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
  showUserMenu?: boolean;
}

export default function Header({
  title,
  description,
  backHref,
  backLabel,
  actions,
  breadcrumbs,
}: HeaderProps) {

  return (
    <header className="bg-white border-b border-[var(--color-parchment)] px-8 py-6">
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-2 text-sm text-[var(--color-stone)] mb-4">
          {breadcrumbs.map((crumb, index) => (
            <span key={index} className="flex items-center gap-2">
              {index > 0 && <span>/</span>}
              {crumb.href ? (
                <Link
                  href={crumb.href}
                  className="hover:text-[var(--color-forest)] transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[var(--color-ink)]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Back button */}
      {backHref && (
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-[var(--color-stone)] hover:text-[var(--color-forest)] transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          {backLabel || 'Back'}
        </Link>
      )}

      {/* Title and actions */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-[var(--color-ink)]">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-[var(--color-stone)]">{description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {actions}
        </div>
      </div>
    </header>
  );
}

