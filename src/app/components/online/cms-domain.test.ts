import { describe, expect, it } from 'vitest';
import {
  isOnlineProductAvailable,
  syncOnlineProductAvailability,
  validateSponsor,
  groupMediaByDate,
  getMediaDates,
  validateMediaItem,
} from './cms-domain';
import type { OnlineProduct, Sponsor, MediaItem, Product } from '../store';

describe('online/cms-domain - isOnlineProductAvailable', () => {
  const stockProducts: Product[] = [
    {
      id: 'p1', name: 'Coca-Cola', code: '', description: '', category: 'Bebidas',
      unit: 'unidades', image: '',
      stockByWarehouse: [{ warehouseId: 'w1', quantity: 10 }],
    },
    {
      id: 'p2', name: 'Agua', code: '', description: '', category: 'Bebidas',
      unit: 'unidades', image: '',
      stockByWarehouse: [{ warehouseId: 'w1', quantity: 0 }],
    },
  ];

  it('returns true when no stockProductId is linked', () => {
    const product: OnlineProduct = {
      id: 'op1', name: 'Free Item', description: '', price: 100, images: [],
      category: 'General', attributes: {}, active: true,
    };
    expect(isOnlineProductAvailable(product, stockProducts)).toBe(true);
  });

  it('returns true when linked stock > 0', () => {
    const product: OnlineProduct = {
      id: 'op1', name: 'Coca-Cola', description: '', price: 100, images: [],
      category: 'Bebidas', attributes: {}, active: true, stockProductId: 'p1',
    };
    expect(isOnlineProductAvailable(product, stockProducts)).toBe(true);
  });

  it('returns false when linked stock = 0', () => {
    const product: OnlineProduct = {
      id: 'op2', name: 'Agua', description: '', price: 50, images: [],
      category: 'Bebidas', attributes: {}, active: true, stockProductId: 'p2',
    };
    expect(isOnlineProductAvailable(product, stockProducts)).toBe(false);
  });

  it('returns false when product is inactive', () => {
    const product: OnlineProduct = {
      id: 'op1', name: 'Coca-Cola', description: '', price: 100, images: [],
      category: 'Bebidas', attributes: {}, active: false, stockProductId: 'p1',
    };
    expect(isOnlineProductAvailable(product, stockProducts)).toBe(false);
  });

  it('returns false when linked stock product does not exist', () => {
    const product: OnlineProduct = {
      id: 'op3', name: 'Ghost', description: '', price: 100, images: [],
      category: 'General', attributes: {}, active: true, stockProductId: 'nonexistent',
    };
    expect(isOnlineProductAvailable(product, stockProducts)).toBe(false);
  });
});

describe('online/cms-domain - syncOnlineProductAvailability', () => {
  const stockProducts: Product[] = [
    {
      id: 'p1', name: 'Coca-Cola', code: '', description: '', category: 'Bebidas',
      unit: 'unidades', image: '',
      stockByWarehouse: [{ warehouseId: 'w1', quantity: 0 }],
    },
  ];

  it('deactivates product when stock runs out', () => {
    const product: OnlineProduct = {
      id: 'op1', name: 'Coca-Cola', description: '', price: 100, images: [],
      category: 'Bebidas', attributes: {}, active: true, stockProductId: 'p1',
    };
    const synced = syncOnlineProductAvailability(product, stockProducts);
    expect(synced.active).toBe(false);
  });

  it('does not reactivate already inactive product', () => {
    const product: OnlineProduct = {
      id: 'op1', name: 'Coca-Cola', description: '', price: 100, images: [],
      category: 'Bebidas', attributes: {}, active: false, stockProductId: 'p1',
    };
    const synced = syncOnlineProductAvailability(product, stockProducts);
    expect(synced.active).toBe(false);
  });
});

describe('online/cms-domain - validateSponsor', () => {
  it('passes valid sponsor', () => {
    const errors = validateSponsor({
      name: 'Gatorade', imageUrl: 'https://example.com/gatorade.png',
      placement: 'banner', active: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty name', () => {
    const errors = validateSponsor({
      name: '', imageUrl: 'https://example.com/img.png',
      placement: 'banner', active: true,
    });
    expect(errors).toContain('El nombre es obligatorio.');
  });

  it('rejects empty imageUrl', () => {
    const errors = validateSponsor({
      name: 'Gatorade', imageUrl: '', placement: 'banner', active: true,
    });
    expect(errors).toContain('La URL de imagen es obligatoria.');
  });

  it('rejects invalid linkUrl', () => {
    const errors = validateSponsor({
      name: 'Gatorade', imageUrl: 'https://example.com/img.png',
      placement: 'banner', active: true, linkUrl: 'not-a-url',
    });
    expect(errors).toContain('La URL del link no es valida.');
  });
});

describe('online/cms-domain - groupMediaByDate', () => {
  const media: MediaItem[] = [
    { id: 'm1', matchDate: '2026-05-24', type: 'image', url: 'img1.jpg', title: 'Gol 1', createdAtISO: '' },
    { id: 'm2', matchDate: '2026-05-24', type: 'video', url: 'vid1.mp4', title: 'Highlight', createdAtISO: '' },
    { id: 'm3', matchDate: '2026-05-17', type: 'image', url: 'img2.jpg', title: 'Gol 2', createdAtISO: '' },
    { id: 'm4', type: 'image', url: 'img3.jpg', title: 'Sin fecha', createdAtISO: '' },
  ];

  it('groups media by match date', () => {
    const grouped = groupMediaByDate(media);
    expect(grouped['2026-05-24']).toHaveLength(2);
    expect(grouped['2026-05-17']).toHaveLength(1);
    expect(grouped['sin-fecha']).toHaveLength(1);
  });

  it('sorts dates descending', () => {
    const grouped = groupMediaByDate(media);
    const keys = Object.keys(grouped);
    expect(keys[0]).toBe('2026-05-24');
    expect(keys[1]).toBe('2026-05-17');
    expect(keys[2]).toBe('sin-fecha');
  });
});

describe('online/cms-domain - getMediaDates', () => {
  it('returns unique dates sorted descending', () => {
    const media: MediaItem[] = [
      { id: 'm1', matchDate: '2026-05-17', type: 'image', url: '', title: '', createdAtISO: '' },
      { id: 'm2', matchDate: '2026-05-24', type: 'image', url: '', title: '', createdAtISO: '' },
      { id: 'm3', matchDate: '2026-05-17', type: 'video', url: '', title: '', createdAtISO: '' },
      { id: 'm4', type: 'image', url: '', title: '', createdAtISO: '' }, // no date
    ];
    const dates = getMediaDates(media);
    expect(dates).toEqual(['2026-05-24', '2026-05-17']);
  });
});

describe('online/cms-domain - validateMediaItem', () => {
  it('passes valid media item', () => {
    const errors = validateMediaItem({
      title: 'Gol del partido', type: 'image', url: 'https://example.com/goal.jpg',
      matchDate: '2026-05-24',
    });
    expect(errors).toHaveLength(0);
  });

  it('rejects empty title', () => {
    const errors = validateMediaItem({
      title: '', type: 'image', url: 'https://example.com/img.jpg',
    });
    expect(errors).toContain('El titulo es obligatorio.');
  });

  it('rejects empty url', () => {
    const errors = validateMediaItem({
      title: 'Test', type: 'image', url: '',
    });
    expect(errors).toContain('La URL es obligatoria.');
  });

  it('rejects invalid date format', () => {
    const errors = validateMediaItem({
      title: 'Test', type: 'image', url: 'https://example.com/img.jpg',
      matchDate: '24-05-2026',
    });
    expect(errors).toContain('La fecha debe tener formato YYYY-MM-DD.');
  });

  it('allows missing matchDate', () => {
    const errors = validateMediaItem({
      title: 'Test', type: 'image', url: 'https://example.com/img.jpg',
    });
    expect(errors).toHaveLength(0);
  });
});
