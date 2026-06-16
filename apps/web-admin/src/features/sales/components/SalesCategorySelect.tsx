import { useEffect, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ProductEmojiPicker } from '@/features/sales/components/ProductEmojiPicker';
import { getSalesCategoryEmoji } from '@/features/sales/lib/sales-categories';

type SalesCategorySelectProps = {
  value: string;
  categories: string[];
  categoryEmojis?: Record<string, string>;
  onChange: (category: string, emoji?: string) => void;
  onAddCategory: (name: string, emoji: string) => string | null;
};

export function SalesCategorySelect({
  value,
  categories,
  categoryEmojis = {},
  onChange,
  onAddCategory,
}: SalesCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('🍽️');
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const emojiFor = (category: string) => getSalesCategoryEmoji(category, categoryEmojis);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const pickCategory = (category: string) => {
    setShowNewForm(false);
    onChange(category);
    setOpen(false);
  };

  const openNewForm = () => {
    setShowNewForm(true);
    setOpen(false);
    setNewCategoryName('');
    setNewCategoryEmoji('🍽️');
    setError('');
  };

  const handleCreateCategory = () => {
    const created = onAddCategory(newCategoryName, newCategoryEmoji);
    if (!created) {
      setError('Ingresá un nombre válido o usá una categoría existente.');
      return;
    }
    onChange(created, newCategoryEmoji);
    setShowNewForm(false);
    setNewCategoryName('');
    setNewCategoryEmoji('🍽️');
    setError('');
  };

  const resetNewForm = () => {
    setShowNewForm(false);
    setNewCategoryName('');
    setNewCategoryEmoji('🍽️');
    setError('');
  };

  const displayValue = showNewForm
    ? '+ Nueva categoría'
    : value
      ? `${emojiFor(value)} ${value}`
      : '';

  return (
    <div ref={rootRef} className="relative">
      <label className="text-sm text-muted-foreground mb-1 block">Categoría</label>
      <button
        type="button"
        onClick={() => setOpen(prev => !prev)}
        className="w-full px-3 py-2 border border-border rounded-lg bg-input-background text-left text-foreground"
      >
        <span className={`block truncate ${!displayValue ? 'text-muted-foreground' : ''}`}>
          {displayValue || (categories[0] ? `${emojiFor(categories[0])} ${categories[0]}` : 'Seleccionar categoría...')}
        </span>
      </button>

      {open && (
        <div className="absolute z-[100] top-full left-0 right-0 mt-0 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
            <div className="max-h-48 overflow-y-auto">
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => pickCategory(category)}
                  className={`w-full px-3 py-2 text-sm text-left hover:bg-muted transition-colors ${!showNewForm && value === category ? 'bg-muted' : 'text-foreground'}`}
                >
                  {emojiFor(category)} {category}
                </button>
              ))}
            </div>
            <div className="border-t border-border">
              <button
                type="button"
                onClick={openNewForm}
                className="w-full px-3 py-2 text-sm text-left text-foreground hover:bg-muted transition-colors"
              >
                + Nueva categoría
              </button>
            </div>
          </div>
      )}

      {showNewForm && (
        <div className="mt-2 rounded-lg border border-border bg-muted p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Plus className="h-4 w-4 text-emerald-600" />
            Nueva categoría
          </div>
          <div className="flex gap-2">
            <ProductEmojiPicker
              value={newCategoryEmoji}
              onChange={setNewCategoryEmoji}
            />
            <input
              value={newCategoryName}
              onChange={(e) => {
                setNewCategoryName(e.target.value);
                setError('');
              }}
              placeholder="Nombre de la categoría..."
              className="min-w-0 flex-1 px-3 py-2 border border-border rounded-lg bg-input-background"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateCategory();
                }
              }}
            />
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetNewForm}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleCreateCategory}
              className="px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
            >
              Crear categoría
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
