import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAppContext } from '../../AppContext';
import { useSalesApiAdapter } from '../../../api/adapters';
import {
  deductStockForSale,
  getMaxSellableUnits,
  getTotalStockQuantity,
  restoreStockForTicket,
  validateStockForCart,
} from '../stock-link';
import { createKitchenOrdersFromTicket } from '../../kitchen/domain';
import { isLocalOnlyTicketId } from '../sales-metrics';
import type { SalesTicket as ApiSalesTicket } from '../../../api/client';
import type { Kitchen, Product, SalesHistoryEntry, SalesProduct, SalesTicket } from '../../store';
import { OrderItem, Station, stations } from './mockData';

export type { OrderItem, Station };
export { stations };

export type PosTicket = {
  id: string;
  number: number;
  createdAt: string;
  createdAtISO: string;
  items: OrderItem[];
  total: number;
  status: 'emitido' | 'anulado';
  kind: 'venta' | 'devolucion';
  voidReason?: string;
  voidedAt?: string;
  source: 'Mostrador' | 'Mesa';
  context?: string;
  operator: string;
  operatorId: string;
};

export type PosProduct = {
  id: string;
  name: string;
  price: number;
  category: 'Bebidas' | 'Comidas' | 'Snacks' | 'Postres' | 'Promos';
  station: Station;
  stock: number;
  emoji: string;
  recipe?: { ingredientId: string; qty: number }[];
};

export type PosIngredient = {
  id: string;
  name: string;
  unit: string;
  stock: number;
};

export type Printer = {
  id: string;
  name: string;
  type: 'Comandera Cocina' | 'Mostrador' | 'Barra';
  ip: string;
  paperWidth: 58 | 80;
  connected: boolean;
  isDefault: boolean;
};

export type TicketTemplate = {
  header: string;
  subheader: string;
  footer: string;
  showLogo: boolean;
  showDate: boolean;
  showOperator: boolean;
  showItemDetails: boolean;
  fontSize: 'sm' | 'md' | 'lg';
};

type VentasPosStore = {
  tickets: PosTicket[];
  products: PosProduct[];
  ingredients: PosIngredient[];
  kitchens: Kitchen[];
  currentUser: { id: string; name: string; role: string };
  apiOnline: boolean | null;
  toast: string | null;
  setToast: (msg: string | null) => void;
  salesTickets: SalesTicket[];
  printTicket: (
    t: Omit<
      PosTicket,
      'id' | 'number' | 'createdAt' | 'createdAtISO' | 'status' | 'operator' | 'operatorId' | 'kind'
    >,
  ) => Promise<PosTicket | null>;
  voidTicket: (id: string, reason?: string) => Promise<PosTicket | null>;
  replaceTicketItems: (id: string, items: OrderItem[]) => PosTicket | null;
  printReturn: (items: OrderItem[]) => PosTicket | null;
  saveProduct: (p: PosProduct) => void;
  deleteProduct: (id: string) => void;
  saveIngredient: (i: PosIngredient) => void;
  printers: Printer[];
  template: TicketTemplate;
  salesTables: ReturnType<typeof useAppContext>['salesTables'];
  setSalesTables: ReturnType<typeof useAppContext>['setSalesTables'];
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  salesHistory: SalesHistoryEntry[];
  users: { id: string; name: string; role: string }[];
  pendingEdit: { ticketId: string; items: OrderItem[] } | null;
  requestEditTicket: (ticket: PosTicket) => void;
  clearPendingEdit: () => void;
};

const VentasPosContext = createContext<VentasPosStore | null>(null);

const initialPrinters: Printer[] = [
  {
    id: 'pr1',
    name: 'Comandera Cocina',
    type: 'Comandera Cocina',
    ip: '192.168.1.50',
    paperWidth: 80,
    connected: true,
    isDefault: true,
  },
];

const initialTemplate: TicketTemplate = {
  header: 'LA CHACRA FUTBOL — CANTINA',
  subheader: 'Sistema de Gestión LCH',
  footer: '¡Gracias por tu compra!',
  showLogo: true,
  showDate: true,
  showOperator: true,
  showItemDetails: true,
  fontSize: 'md',
};

function stationFromKitchen(kitchen: Kitchen | undefined): Station {
  const name = kitchen?.name ?? 'Cocina';
  if (stations.includes(name as Station)) return name as Station;
  return 'Cocina';
}

function mapCategory(category: string): PosProduct['category'] {
  if (category === 'Bebidas' || category === 'Comidas' || category === 'Snacks' || category === 'Postres') {
    return category;
  }
  if (category === 'Promos') return 'Promos';
  return 'Comidas';
}

function mapApiTicketToLocal(
  api: ApiSalesTicket,
  operatorName: string,
  salesProducts: SalesProduct[],
): SalesTicket {
  const createdAtISO =
    typeof api.createdAt === 'string'
      ? api.createdAt.includes('T')
        ? api.createdAt
        : new Date(api.createdAt).toISOString()
      : new Date().toISOString();

  const status =
    api.status === 'anulado' || api.status === 'devuelto' || api.status === 'emitido'
      ? api.status
      : 'emitido';

  return {
    id: api.id,
    number: api.number,
    createdAtISO,
    status,
    items: api.items.map(i => ({
      salesProductId: i.salesProductId,
      name: i.name,
      unitPrice: Number(i.unitPrice),
      quantity: i.quantity,
      kitchenId: salesProducts.find(sp => sp.id === i.salesProductId)?.kitchenId || '',
    })),
    total: Number(api.total),
    operatorId: api.operatorId,
    operatorName,
    note: api.note,
  };
}

function ticketToPos(ticket: SalesTicket, operatorName: string): PosTicket {
  const isReturn = ticket.status === 'devuelto';
  return {
    id: ticket.id,
    number: ticket.number,
    createdAt: new Date(ticket.createdAtISO).toLocaleString('es-AR'),
    createdAtISO: ticket.createdAtISO,
    items: ticket.items.map(item => ({
      productId: item.salesProductId,
      name: item.name,
      price: item.unitPrice,
      qty: item.quantity,
    })),
    total: ticket.total,
    status: ticket.status === 'anulado' ? 'anulado' : 'emitido',
    kind: isReturn ? 'devolucion' : 'venta',
    source: ticket.note?.startsWith('Mesa:') ? 'Mesa' : 'Mostrador',
    context: ticket.note,
    operator: ticket.operatorName || operatorName,
    operatorId: ticket.operatorId,
  };
}

export function VentasPosProvider({ children }: { children: ReactNode }) {
  const ctx = useAppContext();
  const salesApi = useSalesApiAdapter();
  const [toast, setToast] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{ ticketId: string; items: OrderItem[] } | null>(
    null,
  );
  const [printers] = useState<Printer[]>(initialPrinters);
  const [template] = useState<TicketTemplate>(initialTemplate);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const currentUser = useMemo(
    () => ({
      id: ctx.currentUser.username,
      name: ctx.currentUser.username,
      role: ctx.currentUser.role,
    }),
    [ctx.currentUser],
  );

  const posProducts = useMemo(
    () =>
      ctx.salesProducts
        .filter(p => p.active)
        .map((sp): PosProduct => {
          const kitchen = ctx.kitchens.find(k => k.id === sp.kitchenId);
          return {
            id: sp.id,
            name: sp.name,
            price: sp.price,
            category: mapCategory(sp.category),
            station: stationFromKitchen(kitchen),
            stock: getMaxSellableUnits(sp, ctx.products),
            emoji: sp.emoji,
            recipe: sp.recipe.map(r => ({ ingredientId: r.stockProductId, qty: r.quantity })),
          };
        }),
    [ctx.salesProducts, ctx.kitchens, ctx.products],
  );

  const ingredients = useMemo(
    () =>
      ctx.products.map(
        (p): PosIngredient => ({
          id: p.id,
          name: p.name,
          unit: p.unit === 'kg' ? 'kg' : 'u',
          stock: getTotalStockQuantity(p),
        }),
      ),
    [ctx.products],
  );

  const tickets = useMemo(
    () => ctx.salesTickets.map(t => ticketToPos(t, currentUser.name)),
    [ctx.salesTickets, currentUser.name],
  );

  const enrichCartKitchens = useCallback(
    (items: OrderItem[]) => {
      const cart = items.map(item => {
        const sp = ctx.salesProducts.find(p => p.id === item.productId);
        const kitchen = ctx.kitchens.find(k => k.id === sp?.kitchenId);
        return {
          salesProductId: item.productId,
          name: item.name,
          unitPrice: item.price,
          quantity: item.qty,
          kitchenId: sp?.kitchenId || '',
          kitchenName: kitchen?.name || '',
        };
      });
      return cart;
    },
    [ctx.salesProducts, ctx.kitchens],
  );

  const finishSaleLocal = useCallback(
    (ticket: SalesTicket, cart: ReturnType<typeof enrichCartKitchens>) => {
      const table = selectedTableId ? ctx.salesTables.find(x => x.id === selectedTableId) : null;
      ctx.setProducts(prev => deductStockForSale(prev, cart, ctx.salesProducts));
      ctx.setSalesTickets(prev => [ticket, ...prev]);
      if (table) {
        ctx.setSalesTables(prev =>
          prev.map(x =>
            x.id === table.id ? { ...x, status: 'ocupada' as const, currentOrderId: ticket.id } : x,
          ),
        );
        const kos = createKitchenOrdersFromTicket(
          ticket,
          ctx.salesProducts,
          ctx.kitchens,
          table.id,
          table.name,
        );
        ctx.setKitchenOrders(prev => [...kos, ...prev]);
      }
      const historyEntry: SalesHistoryEntry = {
        id: `h-${Date.now()}`,
        timestampISO: new Date().toISOString(),
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        type: 'venta',
        detail: `Venta #${ticket.number}`,
        ticketId: ticket.id,
      };
      ctx.setSalesHistory(prev => [historyEntry, ...prev]);
      ctx.addSalesAudit({
        user: currentUser.name,
        action: `Venta registrada #${ticket.number}`,
        element: `Ticket ${ticket.number}`,
        previousValue: '-',
        newValue: `${cart.length} item(s)`,
      });
      setSelectedTableId(null);
      return ticketToPos(ticket, currentUser.name);
    },
    [ctx, currentUser, selectedTableId],
  );

  const printTicket: VentasPosStore['printTicket'] = useCallback(
    async t => {
      const cart = enrichCartKitchens(t.items);
      if (cart.length === 0) return null;

      const validation = validateStockForCart(cart, ctx.salesProducts, ctx.products);
      if (!validation.ok) {
        setToast(`No hay stock: ${validation.missing.map(m => m.name).join(', ')}`);
        return null;
      }

      const table = selectedTableId ? ctx.salesTables.find(x => x.id === selectedTableId) : null;
      const note = t.context || (table ? `Mesa: ${table.name}` : undefined);

      if (salesApi.apiAvailable) {
        const idempotencyKey = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const apiResult = await salesApi.checkout({
          items: cart.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
          operatorId: currentUser.id,
          note,
          idempotencyKey,
        });

        if (apiResult.ok && 'result' in apiResult) {
          const ticket = mapApiTicketToLocal(
            apiResult.result.ticket,
            currentUser.name,
            ctx.salesProducts,
          );
          ctx.setSalesTicketCounter(ticket.number);
          return finishSaleLocal(ticket, cart);
        }
        if (!apiResult.apiUnavailable && 'error' in apiResult) {
          setToast(`Error en venta: ${apiResult.error}`);
          return null;
        }
      }

      const nextCounter = ctx.salesTicketCounter + 1;
      const newTicket: SalesTicket = {
        id: `sale-${Date.now()}`,
        number: nextCounter,
        createdAtISO: new Date().toISOString(),
        status: 'emitido',
        items: cart.map(i => ({
          salesProductId: i.salesProductId,
          name: i.name,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          kitchenId: i.kitchenId,
        })),
        total: t.total,
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        note,
      };
      ctx.setSalesTicketCounter(nextCounter);
      return finishSaleLocal(newTicket, cart);
    },
    [ctx, currentUser, enrichCartKitchens, selectedTableId, salesApi, finishSaleLocal],
  );

  const voidTicket: VentasPosStore['voidTicket'] = useCallback(
    async (id, reason = 'Anulado en mostrador') => {
      const ticket = ctx.salesTickets.find(t => t.id === id);
      if (!ticket || ticket.status !== 'emitido') return null;

      if (salesApi.apiAvailable && !isLocalOnlyTicketId(ticket.id)) {
        const apiResult = await salesApi.voidTicket(id, currentUser.id);
        if (apiResult.ok && 'result' in apiResult) {
          const synced = mapApiTicketToLocal(apiResult.result, currentUser.name, ctx.salesProducts);
          ctx.setProducts(prev => restoreStockForTicket(prev, ticket, ctx.salesProducts));
          ctx.setSalesTickets(prev =>
            prev.map(t => (t.id === id ? { ...synced, status: 'anulado' as const } : t)),
          );
        } else if (!apiResult.apiUnavailable && 'error' in apiResult) {
          setToast(`Error al anular: ${apiResult.error}`);
          return null;
        } else {
          ctx.setProducts(prev => restoreStockForTicket(prev, ticket, ctx.salesProducts));
          ctx.setSalesTickets(prev =>
            prev.map(t => (t.id === id ? { ...t, status: 'anulado' } : t)),
          );
        }
      } else {
        ctx.setProducts(prev => restoreStockForTicket(prev, ticket, ctx.salesProducts));
        ctx.setSalesTickets(prev =>
          prev.map(t => (t.id === id ? { ...t, status: 'anulado' } : t)),
        );
      }

      const historyEntry: SalesHistoryEntry = {
        id: `h-${Date.now()}`,
        timestampISO: new Date().toISOString(),
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        type: 'anulacion',
        detail: `Anulacion ticket #${ticket.number}`,
        ticketId: ticket.id,
      };
      ctx.setSalesHistory(prev => [historyEntry, ...prev]);
      ctx.addSalesAudit({
        user: currentUser.name,
        action: `Anulación ticket #${ticket.number}`,
        element: `Ticket ${ticket.number}`,
        previousValue: 'emitido',
        newValue: reason,
      });

      const pos = ticketToPos({ ...ticket, status: 'anulado' }, currentUser.name);
      return { ...pos, voidReason: reason, voidedAt: new Date().toLocaleString('es-AR') };
    },
    [ctx, currentUser, salesApi],
  );

  const printReturn: VentasPosStore['printReturn'] = useCallback(
    items => {
      const cart = enrichCartKitchens(items);
      if (cart.length === 0) return null;

      const pseudoTicket: SalesTicket = {
        id: `return-${Date.now()}`,
        number: ctx.salesTicketCounter + 1,
        createdAtISO: new Date().toISOString(),
        status: 'emitido',
        items: cart.map(i => ({
          salesProductId: i.salesProductId,
          name: i.name,
          unitPrice: i.unitPrice,
          quantity: i.quantity,
          kitchenId: i.kitchenId,
        })),
        total: items.reduce((s, i) => s + i.price * i.qty, 0),
        operatorId: currentUser.id,
        operatorName: currentUser.name,
      };

      ctx.setProducts(prev => restoreStockForTicket(prev, pseudoTicket, ctx.salesProducts));

      const nextCounter = ctx.salesTicketCounter + 1;
      const devTicket: SalesTicket = {
        ...pseudoTicket,
        id: `sale-${Date.now()}`,
        number: nextCounter,
        status: 'devuelto',
      };
      ctx.setSalesTickets(prev => [devTicket, ...prev]);
      ctx.setSalesTicketCounter(nextCounter);

      const historyEntry: SalesHistoryEntry = {
        id: `h-${Date.now()}`,
        timestampISO: new Date().toISOString(),
        operatorId: currentUser.id,
        operatorName: currentUser.name,
        type: 'devolucion',
        detail: `Devolucion #${nextCounter}`,
        ticketId: devTicket.id,
      };
      ctx.setSalesHistory(prev => [historyEntry, ...prev]);
      ctx.addSalesAudit({
        user: currentUser.name,
        action: `Devolución #${nextCounter}`,
        element: `Ticket ${nextCounter}`,
        previousValue: '-',
        newValue: `${cart.length} item(s)`,
      });

      return ticketToPos(devTicket, currentUser.name);
    },
    [ctx, currentUser, enrichCartKitchens],
  );

  const replaceTicketItems: VentasPosStore['replaceTicketItems'] = useCallback(
    (id, items) => {
      const old = ctx.salesTickets.find(t => t.id === id);
      if (!old || old.status !== 'emitido') return null;

      ctx.setProducts(prev => restoreStockForTicket(prev, old, ctx.salesProducts));
      const cart = enrichCartKitchens(items);
      const validation = validateStockForCart(cart, ctx.salesProducts, ctx.products);
      if (!validation.ok) {
        setToast(`No hay stock: ${validation.missing.map(m => m.name).join(', ')}`);
        ctx.setProducts(prev => restoreStockForTicket(prev, old, ctx.salesProducts));
        return null;
      }

      ctx.setProducts(prev => deductStockForSale(prev, cart, ctx.salesProducts));
      const total = items.reduce((s, i) => s + i.price * i.qty, 0);
      let updated: SalesTicket | null = null;
      ctx.setSalesTickets(prev =>
        prev.map(t => {
          if (t.id !== id) return t;
          updated = {
            ...t,
            items: cart.map(i => ({
              salesProductId: i.salesProductId,
              name: i.name,
              unitPrice: i.unitPrice,
              quantity: i.quantity,
              kitchenId: i.kitchenId,
            })),
            total,
          };
          return updated;
        }),
      );
      return updated ? ticketToPos(updated, currentUser.name) : null;
    },
    [ctx, currentUser, enrichCartKitchens],
  );

  const saveProduct = useCallback(
    (p: PosProduct) => {
      const kitchen = ctx.kitchens.find(k => k.name === p.station) || ctx.kitchens[0];
      const salesProduct: SalesProduct = {
        id: p.id,
        name: p.name,
        category: p.category,
        kitchenId: kitchen?.id || ctx.kitchens[0]?.id || '',
        price: p.price,
        emoji: p.emoji,
        active: true,
        recipe: (p.recipe || []).map(r => ({
          stockProductId: r.ingredientId,
          quantity: r.qty,
        })),
      };
      ctx.setSalesProducts(prev =>
        prev.find(x => x.id === p.id)
          ? prev.map(x => (x.id === p.id ? salesProduct : x))
          : [...prev, salesProduct],
      );
    },
    [ctx],
  );

  const deleteProduct = useCallback(
    (id: string) => {
      ctx.setSalesProducts(prev => prev.filter(p => p.id !== id));
    },
    [ctx],
  );

  const requestEditTicket = useCallback((ticket: PosTicket) => {
    if (ticket.status !== 'emitido' || ticket.kind !== 'venta') return;
    setPendingEdit({
      ticketId: ticket.id,
      items: ticket.items.map(i => ({ ...i })),
    });
  }, []);

  const clearPendingEdit = useCallback(() => setPendingEdit(null), []);

  const saveIngredient = useCallback(
    (ing: PosIngredient) => {
      const stockProduct = ctx.products.find(p => p.id === ing.id);
      if (!stockProduct) return;
      const updated: Product = {
        ...stockProduct,
        name: ing.name,
        unit: ing.unit === 'kg' ? 'kg' : 'unidades',
        stockByWarehouse: stockProduct.stockByWarehouse.map((w, idx) =>
          idx === 0 ? { ...w, quantity: ing.stock } : w,
        ),
      };
      ctx.setProducts(prev => prev.map(p => (p.id === ing.id ? updated : p)));
    },
    [ctx],
  );

  const value: VentasPosStore = {
    tickets,
    salesTickets: ctx.salesTickets,
    products: posProducts,
    ingredients,
    kitchens: ctx.kitchens,
    currentUser,
    apiOnline: salesApi.apiAvailable,
    toast,
    setToast,
    printTicket,
    voidTicket,
    replaceTicketItems,
    printReturn,
    saveProduct,
    deleteProduct,
    saveIngredient,
    printers,
    template,
    salesTables: ctx.salesTables,
    setSalesTables: ctx.setSalesTables,
    selectedTableId,
    setSelectedTableId,
    salesHistory: ctx.salesHistory,
    users: [currentUser],
    pendingEdit,
    requestEditTicket,
    clearPendingEdit,
  };

  return <VentasPosContext.Provider value={value}>{children}</VentasPosContext.Provider>;
}

export function useVentasPos() {
  const store = useContext(VentasPosContext);
  if (!store) throw new Error('useVentasPos debe usarse dentro de VentasPosProvider');
  return store;
}

/** Alias para componentes copiados del prototipo Figma */
export const useStore = useVentasPos;

export type Ticket = PosTicket;
export type Product = PosProduct;
export type Ingredient = PosIngredient;
