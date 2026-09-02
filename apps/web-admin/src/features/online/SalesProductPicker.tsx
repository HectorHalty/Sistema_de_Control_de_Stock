import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { SalesProduct } from '@/app/api/client';
import { onlineFieldClass } from './online-shared';

type Props = {
  products: SalesProduct[];
  alreadyOnWebIds: Set<string>;
  value: string | null;
  onSelect: (product: SalesProduct | null) => void;
};

export function SalesProductPicker({ products, alreadyOnWebIds, value, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = products.find((p) => p.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [...products].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    if (!q) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.emoji?.includes(q),
    );
  }, [products, query]);

  return (
    <div className="relative md:col-span-2">
      <label className="mb-1 block text-xs font-semibold text-muted-foreground">
        Producto de ventas
      </label>
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          className={`${onlineFieldClass()} pl-9`}
          placeholder="Buscar producto de ventas..."
          value={open ? query : selected ? `${selected.emoji ?? ''} ${selected.name}`.trim() : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onSelect(null);
          }}
          onFocus={() => setOpen(true)}
        />
      </div>

      {selected && !open && (
        <p className="mt-1 text-xs text-muted-foreground">
          Precio ventas: ${Number(selected.price).toLocaleString('es-AR')} · {selected.category}
        </p>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} aria-hidden />
          <ul className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-border bg-popover shadow-lg">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</li>
            ) : (
              filtered.map((p) => {
                const onWeb = alreadyOnWebIds.has(p.id);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={onWeb}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => {
                        onSelect(p);
                        setQuery('');
                        setOpen(false);
                      }}
                    >
                      <span className="truncate">
                        {p.emoji ? `${p.emoji} ` : ''}
                        {p.name}
                        <span className="ml-1 text-xs text-muted-foreground">({p.category})</span>
                      </span>
                      <span className="shrink-0 text-xs font-medium">
                        {onWeb ? 'En menú web' : `$${Number(p.price).toLocaleString('es-AR')}`}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </>
      )}
    </div>
  );
}
