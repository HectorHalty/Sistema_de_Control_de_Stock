import { useState } from 'react';
import { Plus } from 'lucide-react';
import { ProductEmojiPicker } from '@/features/sales/components/ProductEmojiPicker';
import { getSalesCategoryEmoji } from '@/features/sales/lib/sales-categories';

const NEW_CATEGORY_VALUE = '__new_category__';

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
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryEmoji, setNewCategoryEmoji] = useState('🍽️');
  const [error, setError] = useState('');

  const emojiFor = (category: string) => getSalesCategoryEmoji(category, categoryEmojis);

  const handleSelectChange = (next: string) => {
    if (next === NEW_CATEGORY_VALUE) {
      setShowNewForm(true);
      setNewCategoryName('');
      setNewCategoryEmoji('🍽️');
      setError('');
      return;
    }
    setShowNewForm(false);
    onChange(next);
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

  return (
    <div>
      <label className="text-sm text-gray-600 mb-1 block">Categoría</label>
      <select
        value={showNewForm ? NEW_CATEGORY_VALUE : value}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white"
      >
        {categories.map((category) => (
          <option key={category} value={category}>
            {emojiFor(category)} {category}
          </option>
        ))}
        <option value={NEW_CATEGORY_VALUE}>+ Nueva categoría</option>
      </select>

      {showNewForm && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
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
              className="min-w-0 flex-1 px-3 py-2 border border-gray-200 rounded-lg bg-white"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateCategory();
                }
              }}
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={resetNewForm}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg"
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
