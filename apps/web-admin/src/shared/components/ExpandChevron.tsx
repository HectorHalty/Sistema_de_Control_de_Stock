import { ChevronDown } from 'lucide-react';

type ExpandChevronProps = {
  expanded?: boolean;
  className?: string;
  size?: number;
};

/** Indicates content expands downward. Rotates up when `expanded` is true. */
export function ExpandChevron({ expanded = false, className = '', size = 16 }: ExpandChevronProps) {
  return (
    <ChevronDown
      size={size}
      className={[
        'text-gray-400 dark:text-muted-foreground flex-shrink-0 transition-transform duration-200',
        expanded ? 'rotate-180' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-hidden
    />
  );
}
