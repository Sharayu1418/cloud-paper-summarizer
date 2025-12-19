'use client';

import { forwardRef, ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center gap-2
      font-medium rounded-lg
      transition-all duration-200 ease-out
      focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const variants = {
      primary: `
        bg-[var(--color-forest)] text-[var(--color-ivory)]
        hover:bg-[var(--color-forest-light)]
        focus-visible:ring-[var(--color-forest)]
        active:scale-[0.98]
      `,
      secondary: `
        bg-[var(--color-parchment)] text-[var(--color-ink)]
        border border-[var(--color-sand)]
        hover:bg-[var(--color-sand)] hover:border-[var(--color-stone)]
        focus-visible:ring-[var(--color-stone)]
        active:scale-[0.98]
      `,
      ghost: `
        bg-transparent text-[var(--color-slate)]
        hover:bg-[var(--color-parchment)] hover:text-[var(--color-ink)]
        focus-visible:ring-[var(--color-stone)]
      `,
      danger: `
        bg-[var(--color-burgundy)] text-[var(--color-ivory)]
        hover:bg-[#7d4444]
        focus-visible:ring-[var(--color-burgundy)]
        active:scale-[0.98]
      `,
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        ref={ref}
        className={clsx(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <svg
            className="animate-spin h-4 w-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          leftIcon
        )}
        {children}
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;

