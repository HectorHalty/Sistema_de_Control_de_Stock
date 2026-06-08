import type { Kitchen, SalesProduct, SalesTable } from './types';

export const initialKitchens: Kitchen[] = [
  { id: 'k-parrilla', name: 'Parrilla', emoji: '🔥', active: true },
  { id: 'k-cocina', name: 'Cocina', emoji: '🍳', active: true },
  { id: 'k-cerveceria', name: 'Cervecería', emoji: '🍺', active: true },
  { id: 'k-barra', name: 'Barra', emoji: '🍹', active: true },
];

export const initialSalesProducts: SalesProduct[] = [];

export const initialTables: SalesTable[] = [];
