import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors disabled:opacity-50',
        variant === 'primary' && 'bg-lch-accent text-lch-bg hover:bg-lch-accent-dim',
        variant === 'secondary' && 'border border-lch-accent/40 bg-lch-accent/10 text-lch-accent',
        variant === 'ghost' && 'border border-lch-border bg-lch-card2 text-lch-muted hover:text-lch-fg',
        variant === 'danger' && 'bg-red-500/15 text-red-300 border border-red-500/30',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
