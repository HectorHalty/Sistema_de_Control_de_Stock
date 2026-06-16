/** Categorías mock que venían precargadas; se eliminan al migrar sesiones viejas. */
export const LEGACY_MOCK_SALES_CATEGORIES = [
  'Comidas',
  'Bebidas',
  'Snacks',
  'Postres',
  'Promos',
] as const;

/** Sin categorías por defecto: el operador las crea al cargar el catálogo. */
export const DEFAULT_SALES_CATEGORIES: readonly string[] = [];

const CATEGORY_EMOJI: Record<string, string> = {};

export function getSalesCategoryEmoji(
  category: string,
  customEmojis: Record<string, string> = {},
): string {
  if (customEmojis[category]) return customEmojis[category];
  return CATEGORY_EMOJI[category] ?? '🍽️';
}

export function mergeSalesCategories(stored: string[], productCategories: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const add = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  };

  stored.forEach(add);
  productCategories.forEach(add);

  return result;
}

export function normalizeCategoryName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
