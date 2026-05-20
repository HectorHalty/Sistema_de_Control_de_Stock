import { useState, useCallback, createContext, useContext } from 'react';
import {
  initialProducts,
  initialSalesProducts,
  type Product,
  type SalesProduct,
  type Sponsor,
  type MediaItem,
  type OnlineProduct,
} from './store';

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    const valueToStore = value instanceof Function ? value(storedValue) : value;
    setStoredValue(valueToStore);
    window.localStorage.setItem(key, JSON.stringify(valueToStore));
  }, [key, storedValue]);

  return [storedValue, setValue] as const;
}

export interface PublicAppState {
  products: Product[];
  salesProducts: SalesProduct[];
  sponsors: Sponsor[];
  mediaItems: MediaItem[];
  onlineProducts: OnlineProduct[];
}

export function usePublicAppState(): PublicAppState {
  const [products] = useLocalStorage<Product[]>('stock-products', initialProducts);
  const [salesProducts] = useLocalStorage<SalesProduct[]>('sales-products', initialSalesProducts);
  const [sponsors] = useLocalStorage<Sponsor[]>('sponsors', []);
  const [mediaItems] = useLocalStorage<MediaItem[]>('media-items', []);
  const [onlineProducts] = useLocalStorage<OnlineProduct[]>('online-products', []);

  return { products, salesProducts, sponsors, mediaItems, onlineProducts };
}

export const PublicAppContext = createContext<PublicAppState | null>(null);

export function usePublicAppContext(): PublicAppState {
  const ctx = useContext(PublicAppContext);
  if (!ctx) throw new Error('usePublicAppContext must be inside PublicAppContext.Provider');
  return ctx;
}
