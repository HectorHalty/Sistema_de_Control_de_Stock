import type { OnlineProduct, Sponsor, MediaItem, Product } from '../store';

// --- Online product domain ---

/**
 * Check if an online product has available stock through its linked stock product.
 * Returns true if no stockProductId is linked (unlimited), or if linked stock > 0.
 */
export function isOnlineProductAvailable(product: OnlineProduct, stockProducts: Product[]): boolean {
  if (!product.active) return false;
  if (!product.stockProductId) return true; // no stock linkage = always available

  const stock = stockProducts.find(p => p.id === product.stockProductId);
  if (!stock) return false;

  return stock.stockByWarehouse.reduce((sum, w) => sum + w.quantity, 0) > 0;
}

/**
 * Sync online product availability based on current stock levels.
 * Returns updated product with active flag adjusted.
 */
export function syncOnlineProductAvailability(product: OnlineProduct, stockProducts: Product[]): OnlineProduct {
  const available = isOnlineProductAvailable(product, stockProducts);
  // Only auto-deactivate if it was active and now has no stock
  if (product.active && !available) {
    return { ...product, active: false };
  }
  return product;
}

// --- Sponsor domain ---

export type SponsorPlacement = 'banner' | 'fullscreen' | 'sidebar';

export const PLACEMENT_LABELS: Record<SponsorPlacement, string> = {
  banner: 'Banner Superior',
  fullscreen: 'Pantalla Completa',
  sidebar: 'Barra Lateral',
};

export function validateSponsor(sponsor: Omit<Sponsor, 'id'>): string[] {
  const errors: string[] = [];
  if (!sponsor.name.trim()) errors.push('El nombre es obligatorio.');
  if (!sponsor.imageUrl.trim()) errors.push('La URL de imagen es obligatoria.');
  if (sponsor.linkUrl && !isValidUrl(sponsor.linkUrl)) errors.push('La URL del link no es valida.');
  return errors;
}

// --- Media domain ---

export function groupMediaByDate(media: MediaItem[]): Record<string, MediaItem[]> {
  const grouped: Record<string, MediaItem[]> = {};

  media.forEach(item => {
    const dateKey = item.matchDate || 'sin-fecha';
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  });

  // Sort dates descending
  const sorted: Record<string, MediaItem[]> = {};
  Object.keys(grouped)
    .sort((a, b) => {
      if (a === 'sin-fecha') return 1;
      if (b === 'sin-fecha') return -1;
      return b.localeCompare(a);
    })
    .forEach(key => { sorted[key] = grouped[key]; });

  return sorted;
}

export function getMediaDates(media: MediaItem[]): string[] {
  const dates = new Set<string>();
  media.forEach(item => {
    if (item.matchDate) dates.add(item.matchDate);
  });
  return Array.from(dates).sort().reverse();
}

export function validateMediaItem(item: Omit<MediaItem, 'id' | 'createdAtISO'>): string[] {
  const errors: string[] = [];
  if (!item.title.trim()) errors.push('El titulo es obligatorio.');
  if (!item.url.trim()) errors.push('La URL es obligatoria.');
  if (item.matchDate && !/^\d{4}-\d{2}-\d{2}$/.test(item.matchDate)) {
    errors.push('La fecha debe tener formato YYYY-MM-DD.');
  }
  return errors;
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}
