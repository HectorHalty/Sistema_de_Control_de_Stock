import type { Kitchen, SalesProduct, SalesTable } from './types';

export const initialKitchens: Kitchen[] = [
  { id: 'k-parrilla', name: 'Parrilla', emoji: '🔥', active: true },
  { id: 'k-cocina', name: 'Cocina', emoji: '🍳', active: true },
  { id: 'k-cerveceria', name: 'Cervecería', emoji: '🍺', active: true },
  { id: 'k-barra', name: 'Barra', emoji: '🍹', active: true },
];

export const initialSalesProducts: SalesProduct[] = [
  {
    id: 'sp-hamburguesa-simple', name: 'Hamburguesa Simple', category: 'Comidas',
    kitchenId: 'k-parrilla', price: 5200, emoji: '🍔', active: true,
    recipe: [{ stockProductId: 'p11', quantity: 1 }, { stockProductId: 'p12', quantity: 1 }, { stockProductId: 'p13', quantity: 1 }],
  },
  {
    id: 'sp-hamburguesa-completa', name: 'Hamburguesa Completa', category: 'Comidas',
    kitchenId: 'k-parrilla', price: 6900, emoji: '🍔', active: true,
    recipe: [{ stockProductId: 'p11', quantity: 1 }, { stockProductId: 'p12', quantity: 1 }, { stockProductId: 'p13', quantity: 2 }],
  },
  {
    id: 'sp-pancho', name: 'Pancho', category: 'Comidas',
    kitchenId: 'k-cocina', price: 3500, emoji: '🌭', active: true,
    recipe: [{ stockProductId: 'p5', quantity: 1 }, { stockProductId: 'p6', quantity: 1 }],
  },
  {
    id: 'sp-coca', name: 'Coca-Cola 500ml', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 2900, emoji: '🥤', active: true,
    recipe: [{ stockProductId: 'p1', quantity: 1 }],
  },
  {
    id: 'sp-agua', name: 'Agua Mineral 500ml', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 2200, emoji: '💧', active: true,
    recipe: [{ stockProductId: 'p2', quantity: 1 }],
  },
  {
    id: 'sp-cerveza', name: 'Cerveza Quilmes Lata', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 3700, emoji: '🍺', active: true,
    recipe: [{ stockProductId: 'p3', quantity: 1 }],
  },
  {
    id: 'sp-papas', name: 'Papas Fritas Grandes', category: 'Snacks',
    kitchenId: 'k-cocina', price: 4100, emoji: '🍟', active: true,
    recipe: [{ stockProductId: 'p4', quantity: 1 }],
  },
  {
    id: 'sp-combo-cantina', name: 'Combo Cantina', category: 'Promos',
    kitchenId: 'k-cocina', price: 9900, emoji: '🎯', active: true,
    recipe: [{ stockProductId: 'p5', quantity: 1 }, { stockProductId: 'p6', quantity: 1 }, { stockProductId: 'p1', quantity: 2 }],
  },
  {
    id: 'sp-fernet', name: 'Fernet Branca 750ml', category: 'Bebidas',
    kitchenId: 'k-barra', price: 8500, emoji: '🥃', active: true,
    recipe: [{ stockProductId: 'p8', quantity: 1 }],
  },
  {
    id: 'sp-gatorade', name: 'Gatorade 500ml', category: 'Bebidas',
    kitchenId: 'k-cerveceria', price: 2500, emoji: '⚡', active: true,
    recipe: [{ stockProductId: 'p9', quantity: 1 }],
  },
];

export const initialTables: SalesTable[] = [
  { id: 't1', name: 'Mesa 1', status: 'libre' },
  { id: 't2', name: 'Mesa 2', status: 'libre' },
  { id: 't3', name: 'Mesa 3', status: 'libre' },
  { id: 't4', name: 'Mesa 4', status: 'libre' },
  { id: 't5', name: 'Mesa 5', status: 'libre' },
  { id: 't6', name: 'Mesa 6', status: 'libre' },
];
