import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { PublicMenuItem, PublicOrder } from '../../api/public-api';

export interface CartLine extends PublicMenuItem {
  qty: number;
}

const CART_KEY = 'lch_public_cart';
const LAST_ORDER_KEY = 'lch_public_last_order';

interface CartContextValue {
  items: CartLine[];
  count: number;
  total: number;
  add: (item: PublicMenuItem) => void;
  remove: (id: string) => void;
  clear: () => void;
  lastOrder: PublicOrder | null;
  setLastOrder: (order: PublicOrder | null) => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? (JSON.parse(raw) as CartLine[]) : [];
  } catch {
    return [];
  }
}

function loadLastOrder(): PublicOrder | null {
  try {
    const raw = localStorage.getItem(LAST_ORDER_KEY);
    return raw ? (JSON.parse(raw) as PublicOrder) : null;
  } catch {
    return null;
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(() => loadCart());
  const [lastOrder, setLastOrderState] = useState<PublicOrder | null>(() => loadLastOrder());

  const setLastOrder = useCallback((order: PublicOrder | null) => {
    setLastOrderState(order);
    if (order) localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
    else localStorage.removeItem(LAST_ORDER_KEY);
  }, []);

  const add = useCallback((item: PublicMenuItem) => {
    setItems((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      const next = existing
        ? prev.map((c) => (c.id === item.id ? { ...c, qty: c.qty + 1 } : c))
        : [...prev, { ...item, qty: 1 }];
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev
        .map((c) => (c.id === id ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0);
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    localStorage.removeItem(CART_KEY);
    setItems([]);
  }, []);

  const count = items.reduce((s, c) => s + c.qty, 0);
  const total = items.reduce((s, c) => s + c.price * c.qty, 0);

  const value = useMemo(
    () => ({ items, count, total, add, remove, clear, lastOrder, setLastOrder }),
    [items, count, total, add, remove, clear, lastOrder],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}

export function formatPrice(value: number) {
  if (value === 0) return 'Gratis';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value);
}
