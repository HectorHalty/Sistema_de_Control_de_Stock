import { useEffect, useRef, useState } from 'react';
import { SALES_PRODUCT_EMOJIS } from '@/features/sales/lib/sales-product-emojis';

type ProductEmojiPickerProps = {
  value: string;
  onChange: (emoji: string) => void;
};

export function ProductEmojiPicker({ value, onChange }: ProductEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="flex h-[42px] w-[42px] items-center justify-center rounded-lg border border-border bg-muted text-2xl transition-colors hover:border-emerald-400 hover:bg-card"
        title="Elegir icono"
        aria-label="Elegir icono"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        {value || '🍽️'}
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-50 mt-1 w-64 max-h-52 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-lg"
        >
          <div className="grid grid-cols-8 gap-1">
            {SALES_PRODUCT_EMOJIS.map(emoji => {
              const selected = value === emoji;
              return (
                <button
                  key={emoji}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={emoji}
                  onClick={() => {
                    onChange(emoji);
                    setOpen(false);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-accent ${
                    selected ? 'bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-600' : ''
                  }`}
                >
                  {emoji}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
