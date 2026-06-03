import type { Product } from '@/app/components/store';

export type SalesCategory = 'Comidas' | 'Bebidas' | 'Snacks' | 'Promos';

export type SalesStation = 'Parrilla' | 'Barra' | 'Cocina';

export interface RecipeItem {
  stockProductId: string;
  quantity: number;
}

export interface SalesMenuProduct {
  id: string;
  name: string;
  category: SalesCategory;
  station: SalesStation;
  price: number;
  emoji: string;
  recipe: RecipeItem[];
  active: boolean;
}

export interface SalesOrderItem {
  menuProductId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface SalesTicket {
  id: string;
  number: number;
  createdAtISO: string;
  status: 'emitido' | 'anulado';
  items: SalesOrderItem[];
  total: number;
  note?: string;
}

export interface MissingStockItem {
  stockProductId: string;
  required: number;
  available: number;
}

export interface SalesValidationResult {
  ok: boolean;
  missing: MissingStockItem[];
  requiredByStockProduct: Record<string, number>;
}

export type StockProduct = Product;
