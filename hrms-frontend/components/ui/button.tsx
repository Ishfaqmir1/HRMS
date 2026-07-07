import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
  isLoading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          size === 'sm' ? 'h-8 px-3 text-sm' : 'h-10 px-4 text-sm',
          variant === 'primary' && 'bg-accent text-white hover:bg-accent-hover',
          variant === 'secondary' && 'bg-white text-ink border border-border hover:bg-paper',
          variant === 'ghost' && 'bg-transparent text-ink-soft hover:bg-paper',
          variant === 'danger' && 'bg-danger text-white hover:opacity-90',
          className,
        )}
        {...props}
      >
        {isLoading ? 'Please wait…' : children}
      </button>
    );
  },
);
Button.displayName = 'Button';
