'use client';

import { forwardRef, InputHTMLAttributes } from 'react';
import clsx from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    { className, label, error, hint, leftIcon, rightIcon, id, ...props },
    ref
  ) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[var(--color-charcoal)] mb-1.5"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-stone)]">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={clsx(
              `w-full px-4 py-2.5 rounded-lg
              bg-white border border-[var(--color-sand)]
              text-[var(--color-ink)] placeholder:text-[var(--color-stone)]
              transition-all duration-200
              focus:outline-none focus:border-[var(--color-forest)] focus:ring-2 focus:ring-[var(--color-forest)]/20
              disabled:bg-[var(--color-cream)] disabled:cursor-not-allowed`,
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error && 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20',
              className
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-stone)]">
              {rightIcon}
            </div>
          )}
        </div>
        {hint && !error && (
          <p className="mt-1.5 text-sm text-[var(--color-stone)] italic">
            {hint}
          </p>
        )}
        {error && (
          <p className="mt-1.5 text-sm text-[var(--color-error)]">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;

