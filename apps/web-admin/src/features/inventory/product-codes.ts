import type { Product } from '@/app/components/store';

/** Prefijos por categoría (alineados con datos iniciales del sistema). */
const CATEGORY_PREFIX: Record<string, string> = {
  Bebidas: 'BEB',
  Snacks: 'SNK',
  'Panadería': 'PAN',
  Carnes: 'CAR',
  Insumos: 'INS',
};

export function getCategoryCodePrefix(category: string): string {
  const trimmed = category.trim();
  const known = CATEGORY_PREFIX[trimmed];
  if (known) return known;

  const normalized = trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
  if (normalized.length >= 3) return normalized.slice(0, 3);
  return (normalized + 'XXX').slice(0, 3);
}

export function formatProductCode(prefix: string, sequence: number): string {
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

/** Asigna códigos secuenciales por categoría según el orden actual de la lista. */
export function reassignProductCodes(products: Product[]): Product[] {
  const counters = new Map<string, number>();
  return products.map(product => {
    const category = product.category.trim() || 'General';
    const prefix = getCategoryCodePrefix(category);
    const seq = (counters.get(category) ?? 0) + 1;
    counters.set(category, seq);
    return { ...product, code: formatProductCode(prefix, seq) };
  });
}

/** Vista previa del próximo código al crear o al cambiar de categoría. */
export function previewNextProductCode(
  products: Product[],
  category: string,
  excludeProductId?: string,
): string {
  const cat = category.trim();
  if (!cat) return '—';
  const prefix = getCategoryCodePrefix(cat);
  const count = products.filter(
    p => p.category.trim() === cat && p.id !== excludeProductId,
  ).length;
  return formatProductCode(prefix, count + 1);
}
