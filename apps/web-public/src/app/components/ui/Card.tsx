import type { ReactNode } from 'react';
import { cn } from './cn';

export function Card({
  children,
  className,
  header,
  accent,
}: {
  children: ReactNode;
  className?: string;
  header?: ReactNode;
  accent?: boolean;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-lch-border bg-lch-card',
        accent && 'border-lch-accent/30',
        className,
      )}
    >
      {header && (
        <div className="border-b border-lch-border/80 bg-lch-card2 px-5 py-3">{header}</div>
      )}
      <div className={cn(!header && 'p-5', header && 'p-5')}>{children}</div>
    </section>
  );
}
