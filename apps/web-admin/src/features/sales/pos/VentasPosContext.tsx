import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAppContext } from '@/app/providers/AppContext';
import { useSalesApiAdapter, usePrintingApiAdapter } from '@/app/api/adapters';
import { getSessionUserId, isUuid } from '@/shared/auth/session';
import {
  buildRequiredStockFromCart,
  deductStockForSale,
  getMaxSellableUnits,
  getTotalStockQuantity,
  restoreStockForTicket,
  validateStockForCart,
} from '../stock-link';
import type { SalesCartLine } from '../stock-link';
import type { StockMovement } from '@/app/components/store';
import { createKitchenOrdersFromTicket } from '@/features/kitchen/domain';
import { isLocalOnlyTicketId } from '../sales-metrics';
import { buildTestTicketPayload } from '../lib/test-ticket';
import { splitTicketByStation } from '../lib/split-ticket-by-station';
import { mapApiTicketToLocal } from '../api/sales-mappers';
import type { Kitchen, Product as StoreProduct, SalesHistoryEntry, SalesProduct, SalesTicket } from '@/app/components/store';
import type { SalesPrinter, TicketTemplate } from '@/features/sales/types';
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
  category: string;
  station: Station;
  stock: number;
  emoji: string;
  kind: 'simple' | 'promo';
  recipe?: { ingredientId: string; qty: number }[];
  bundle?: { productId: string; qty: number }[];
};

export type PosIngredient = {
  id: string;
  name: string;
  unit: 'unidades' | 'kg';
  stock: number;
};

export type Printer = SalesPrinter;
export type { TicketTemplate };

type VentasPosStore = {
  tickets: PosTicket[];
  products: PosProduct[];
  ingredients: PosIngredient[];
  kitchens: Kitchen[];
  currentUser: { id: string; name: string; role: string };
  apiOnline: boolean | null;
  toast: string | null;
  setToast: (msg: string | null) => void;
  /** true mientras checkout/void/return/update están en vuelo contra la API */
  saleBusy: boolean;
  salesTickets: SalesTicket[];
  printTicket: (
    t: Omit<
      PosTicket,
      'id' | 'number' | 'createdAt' | 'createdAtISO' | 'status' | 'operator' | 'operatorId' | 'kind'
    >,
  ) => Promise<PosTicket | null>;
  voidTicket: (id: string, reason?: string) => Promise<PosTicket | null>;
  replaceTicketItems: (id: string, items: OrderItem[]) => Promise<PosTicket | null>;
  printReturn: (items: OrderItem[]) => Promise<PosTicket | null>;
  salesCategories: string[];
  salesCategoryEmojis: Record<string, string>;
  addSalesCategory: (name: string, emoji?: string) => string | null;
  saveProduct: (p: PosProduct) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  createKitchen: (input: { name: string; emoji?: string }) => Promise<void>;
  updateKitchen: (id: string, patch: { name?: string; emoji?: string; active?: boolean }) => Promise<void>;
  deleteKitchen: (id: string) => Promise<void>;
  saveIngredient: (i: PosIngredient) => Promise<void>;
  printers: Printer[];
  addPrinter: (printer: Omit<Printer, 'id'>) => void;
  updatePrinter: (id: string, patch: Partial<Printer>) => void;
  removePrinter: (id: string) => void;
  setDefaultPrinter: (id: string) => void;
  togglePrinter: (id: string) => void;
  testPrinter: (
    printer: Printer,
  ) => Promise<{ ok: boolean; error?: string; apiUnavailable?: boolean }>;
  printTestTicket: (
    printer: Printer,
  ) => Promise<{ ok: boolean; error?: string; apiUnavailable?: boolean }>;
  printToPrinter: (
    ticket: PosTicket,
    printer: Printer,
  ) => Promise<{ ok: boolean; error?: string; apiUnavailable?: boolean }>;
  template: TicketTemplate;
  updateTemplate: (patch: Partial<TicketTemplate>) => void;
  salesTables: ReturnType<typeof useAppContext>['salesTables'];
  setSalesTables: ReturnType<typeof useAppContext>['setSalesTables'];
  selectedTableId: string | null;
  setSelectedTableId: (id: string | null) => void;
  salesHistory: SalesHistoryEntry[];
  teamAccounts: import('@/features/sales/types').TeamAccount[];
  setTeamAccounts: ReturnType<typeof useAppContext>['setTeamAccounts'];
  users: { id: string; name: string; role: string }[];
  pendingEdit: { ticketId: string; items: OrderItem[] } | null;
  requestEditTicket: (ticket: PosTicket) => void;
  clearPendingEdit: () => void;
};

const VentasPosContext = createContext<VentasPosStore | null>(null);

function stationFromKitchen(kitchen: Kitchen | undefined): Station {
  return kitchen?.name ?? 'Cocina';
}

function mapCategory(category: string): string {
  return category.trim();
}

function ticketToPos(ticket: SalesTicket, operatorName: string, kitchens: Kitchen[]): PosTicket {
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
      station: kitchens.find(k => k.id === item.kitchenId)?.name || '',
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

/**
 * Construye los asientos del libro de movimientos a partir de líneas de venta.
 * `direction` = -1 para salidas (venta) y +1 para reposiciones (anulación/devolución).
 */
function buildStockMovementsFromCart(
  cartLines: SalesCartLine[],
  salesProducts: SalesProduct[],
  type: StockMovement['type'],
  direction: 1 | -1,
  reference: string,
  operator: { id: string; name: string },
): Omit<StockMovement, 'id' | 'createdAtISO'>[] {
  const required = buildRequiredStockFromCart(cartLines, salesProducts);
  return Object.entries(required).map(([productId, qty]) => ({
    type,
    productId,
    quantity: direction * Math.abs(qty),
    reference,
    operatorId: operator.id,
    operatorName: operator.name,
  }));
}

export function VentasPosProvider({ children }: { children: ReactNode }) {
  const ctx = useAppContext();
  const salesApi = useSalesApiAdapter();
  const printingApi = usePrintingApiAdapter();
  const [toast, setToast] = useState<string | null>(null);
  const [pendingEdit, setPendingEdit] = useState<{ ticketId: string; items: OrderItem[] } | null>(
    null,
  );
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);

  const currentUser = useMemo(() => {
    const id =
      getSessionUserId() ??
      (ctx.currentUser.id && isUuid(ctx.currentUser.id) ? ctx.currentUser.id : '');
    return {
      id,
      name: ctx.currentUser.username,
      role: ctx.currentUser.role,
    };
  }, [ctx.currentUser]);

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
            stock: getMaxSellableUnits(sp, ctx.products, ctx.salesProducts),
            emoji: sp.emoji,
            kind: sp.kind === 'promo' ? 'promo' : 'simple',
            recipe: sp.recipe.map(r => ({ ingredientId: r.stockProductId, qty: r.quantity })),
            bundle: (sp.bundle ?? []).map(b => ({ productId: b.salesProductId, qty: b.quantity })),
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
          unit: p.unit,
          stock: getTotalStockQuantity(p),
        }),
      ),
    [ctx.products],
  );

  const tickets = useMemo(
    () => ctx.salesTickets.map(t => ticketToPos(t, currentUser.name, ctx.kitchens)),
    [ctx.salesTickets, currentUser.name, ctx.kitchens],
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
    (
      ticket: SalesTicket,
      cart: ReturnType<typeof enrichCartKitchens>,
      deductLocally = true,
    ) => {
      const table = selectedTableId ? ctx.salesTables.find(x => x.id === selectedTableId) : null;
      // Si la venta se confirmó contra la API, el stock ya se descontó server-side;
      // evitamos el doble descuento local y re-hidratamos el stock más abajo.
      if (deductLocally) {
        ctx.setProducts(prev => deductStockForSale(prev, cart, ctx.salesProducts));
        ctx.addStockMovements(
          buildStockMovementsFromCart(
            cart.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
            ctx.salesProducts,
            'venta',
            -1,
            ticket.id,
            currentUser,
          ),
          ticket.createdAtISO,
        );
      }
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
      return ticketToPos(ticket, currentUser.name, ctx.kitchens);
    },
    [ctx, currentUser, selectedTableId],
  );

  const printTicket: VentasPosStore['printTicket'] = useCallback(
    async t => {
      const cart = enrichCartKitchens(t.items);
      if (cart.length === 0) return null;

      const table = selectedTableId ? ctx.salesTables.find(x => x.id === selectedTableId) : null;
      const note = t.context || (table ? `Mesa: ${table.name}` : undefined);
      const offlineMode = ctx.salesApiAvailable === false;

      if (!offlineMode) {
        if (salesApi.apiAvailable === false) {
          setToast('Servidor no disponible. La venta no se puede guardar sin conexión a la API.');
          return null;
        }

        const operatorId = currentUser.id;
        if (!operatorId) {
          setToast('Sesión inválida. Cerrá sesión y volvé a ingresar.');
          return null;
        }

        const unsynced = cart.filter(i => !isUuid(i.salesProductId));
        if (unsynced.length > 0) {
          setToast(
            'Hay productos no sincronizados con el servidor. Recargá la página o recrealos en Ventas → Productos.',
          );
          return null;
        }

        // Validación rápida con caché local; el servidor valida stock de forma autoritativa en checkout.
        if (ctx.validateStockOnSale !== false) {
          const validation = validateStockForCart(cart, ctx.salesProducts, ctx.products);
          if (!validation.ok) {
            setToast(`No hay stock: ${validation.missing.map(m => m.name).join(', ')}`);
            return null;
          }
        }

        const idempotencyKey = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const apiResult = await salesApi.checkout({
          items: cart.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
          operatorId,
          note,
          idempotencyKey,
        });

        if (apiResult.ok && 'result' in apiResult) {
          const ticket = mapApiTicketToLocal(
            apiResult.result.ticket,
            ctx.salesProducts,
            currentUser.name,
          );
          ctx.invalidateSalesHydration();
          ctx.invalidateInventoryHydration();
          ctx.setSalesTicketCounter(ticket.number);
          const pos = finishSaleLocal(ticket, cart, true);
          void ctx.hydrateTickets(ctx.salesProducts).catch(() => undefined);
          void ctx.refreshStockProducts().catch(() => undefined);
          return pos;
        }
        if ('error' in apiResult && apiResult.error) {
          setToast(`Error en venta: ${apiResult.error}`);
          return null;
        }
        setToast('No se pudo guardar la venta en el servidor.');
        return null;
      }

      const validation = validateStockForCart(cart, ctx.salesProducts, ctx.products);
      if (!validation.ok) {
        setToast(`No hay stock: ${validation.missing.map(m => m.name).join(', ')}`);
        return null;
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

      let apiHandled = false;

      if (salesApi.apiAvailable && !isLocalOnlyTicketId(ticket.id)) {
        const apiResult = await salesApi.voidTicket(id, currentUser.id);
        if (apiResult.ok && 'result' in apiResult) {
          apiHandled = true;
          const synced = mapApiTicketToLocal(apiResult.result, ctx.salesProducts, currentUser.name);
          ctx.invalidateSalesHydration();
          ctx.invalidateInventoryHydration();
          void ctx.refreshStockProducts().catch(() => undefined);
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

      if (!apiHandled) {
        ctx.addStockMovements(
          buildStockMovementsFromCart(
            ticket.items.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
            ctx.salesProducts,
            'venta_anulada',
            1,
            ticket.id,
            currentUser,
          ),
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

      const pos = ticketToPos({ ...ticket, status: 'anulado' }, currentUser.name, ctx.kitchens);
      return { ...pos, voidReason: reason, voidedAt: new Date().toLocaleString('es-AR') };
    },
    [ctx, currentUser, salesApi],
  );

  const printReturn: VentasPosStore['printReturn'] = useCallback(
    async items => {
      const cart = enrichCartKitchens(items);
      if (cart.length === 0) return null;

      if (salesApi.apiAvailable !== false) {
        const operatorId = currentUser.id;
        if (!operatorId) {
          setToast('Sesión inválida. Cerrá sesión y volvé a ingresar.');
          return null;
        }

        const unsynced = cart.filter(i => !isUuid(i.salesProductId));
        if (unsynced.length > 0) {
          setToast(
            'Hay productos no sincronizados con el servidor. Recargá la página o recrealos en Ventas → Productos.',
          );
          return null;
        }

        const idempotencyKey = `return-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const apiResult = await salesApi.returnItems({
          items: cart.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
          operatorId,
          idempotencyKey,
        });

        if (apiResult.ok && 'result' in apiResult) {
          const ticket = mapApiTicketToLocal(
            apiResult.result.ticket,
            ctx.salesProducts,
            currentUser.name,
          );
          ctx.invalidateSalesHydration();
          ctx.invalidateInventoryHydration();
          ctx.setSalesTicketCounter(ticket.number);
          ctx.setSalesTickets(prev => [ticket, ...prev]);
          void ctx.hydrateTickets(ctx.salesProducts).catch(() => undefined);
          void ctx.refreshStockProducts().catch(() => undefined);

          const historyEntry: SalesHistoryEntry = {
            id: `h-${Date.now()}`,
            timestampISO: new Date().toISOString(),
            operatorId: currentUser.id,
            operatorName: currentUser.name,
            type: 'devolucion',
            detail: `Devolucion #${ticket.number}`,
            ticketId: ticket.id,
          };
          ctx.setSalesHistory(prev => [historyEntry, ...prev]);
          ctx.addSalesAudit({
            user: currentUser.name,
            action: `Devolución #${ticket.number}`,
            element: `Ticket ${ticket.number}`,
            previousValue: '-',
            newValue: `${cart.length} item(s)`,
          });

          return ticketToPos(ticket, currentUser.name, ctx.kitchens);
        }
        if (!apiResult.apiUnavailable && 'error' in apiResult) {
          setToast(`Error en devolución: ${apiResult.error}`);
          return null;
        }
        if (apiResult.apiUnavailable) {
          setToast('Servidor no disponible. Reintentá cuando la API esté en línea.');
          return null;
        }
        return null;
      }

      if (salesApi.apiAvailable !== false) {
        setToast('Servidor no disponible. Reintentá cuando la API esté en línea.');
        return null;
      }

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
      ctx.addStockMovements(
        buildStockMovementsFromCart(
          cart.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
          ctx.salesProducts,
          'devolucion',
          1,
          pseudoTicket.id,
          currentUser,
        ),
      );

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

      return ticketToPos(devTicket, currentUser.name, ctx.kitchens);
    },
    [ctx, currentUser, enrichCartKitchens, salesApi],
  );

  const replaceTicketItems: VentasPosStore['replaceTicketItems'] = useCallback(
    async (id, items) => {
      const old = ctx.salesTickets.find(t => t.id === id);
      if (!old || old.status !== 'emitido') return null;

      const cart = enrichCartKitchens(items);
      if (cart.length === 0) return null;

      if (salesApi.apiAvailable !== false && !isLocalOnlyTicketId(id)) {
        const operatorId = currentUser.id;
        if (!operatorId) {
          setToast('Sesión inválida. Cerrá sesión y volvé a ingresar.');
          return null;
        }

        const unsynced = cart.filter(i => !isUuid(i.salesProductId));
        if (unsynced.length > 0) {
          setToast('Hay productos no sincronizados con el servidor.');
          return null;
        }

        const apiResult = await salesApi.updateTicketItems(id, {
          items: cart.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
          operatorId,
        });

        if (apiResult.ok && 'result' in apiResult) {
          const synced = mapApiTicketToLocal(apiResult.result, ctx.salesProducts, currentUser.name);
          ctx.invalidateSalesHydration();
          ctx.invalidateInventoryHydration();
          ctx.setSalesTickets(prev => prev.map(t => (t.id === id ? synced : t)));
          void ctx.hydrateTickets(ctx.salesProducts).catch(() => undefined);
          void ctx.refreshStockProducts().catch(() => undefined);
          return ticketToPos(synced, currentUser.name, ctx.kitchens);
        }
        if (!apiResult.apiUnavailable && 'error' in apiResult) {
          setToast(`Error al editar ticket: ${apiResult.error}`);
          return null;
        }
        setToast('Servidor no disponible. Reintentá cuando la API esté en línea.');
        return null;
      }

      if (salesApi.apiAvailable !== false && !isLocalOnlyTicketId(id)) {
        setToast('Servidor no disponible. Reintentá cuando la API esté en línea.');
        return null;
      }

      ctx.setProducts(prev => restoreStockForTicket(prev, old, ctx.salesProducts));
      const validation = validateStockForCart(cart, ctx.salesProducts, ctx.products);
      if (!validation.ok) {
        setToast(`No hay stock: ${validation.missing.map(m => m.name).join(', ')}`);
        ctx.setProducts(prev => restoreStockForTicket(prev, old, ctx.salesProducts));
        return null;
      }

      ctx.setProducts(prev => deductStockForSale(prev, cart, ctx.salesProducts));
      ctx.addStockMovements([
        ...buildStockMovementsFromCart(
          old.items.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
          ctx.salesProducts,
          'venta_anulada',
          1,
          old.id,
          currentUser,
        ),
        ...buildStockMovementsFromCart(
          cart.map(i => ({ salesProductId: i.salesProductId, quantity: i.quantity })),
          ctx.salesProducts,
          'venta',
          -1,
          old.id,
          currentUser,
        ),
      ]);
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
      return updated ? ticketToPos(updated, currentUser.name, ctx.kitchens) : null;
    },
    [ctx, currentUser, enrichCartKitchens, salesApi],
  );

  const saveProduct = useCallback(
    async (p: PosProduct) => {
      const kitchen = ctx.kitchens.find(k => k.name === p.station) || ctx.kitchens[0];
      const exists = ctx.salesProducts.some(x => x.id === p.id);
      const salesProduct: SalesProduct = {
        id: p.id,
        name: p.name,
        category: p.category,
        kitchenId: kitchen?.id || ctx.kitchens[0]?.id || '',
        price: p.price,
        emoji: p.emoji,
        active: true,
        kind: p.kind === 'promo' ? 'promo' : 'simple',
        recipe: (p.recipe || []).map(r => ({
          stockProductId: r.ingredientId,
          quantity: r.qty,
        })),
        bundle: (p.bundle || []).map(b => ({
          salesProductId: b.productId,
          quantity: b.qty,
        })),
      };
      try {
        if (exists) {
          await ctx.updateSalesProduct(salesProduct);
        } else {
          await ctx.createSalesProduct(salesProduct);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'No se pudo guardar el producto';
        setToast(msg);
        throw e;
      }
    },
    [ctx],
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      try {
        await ctx.deleteSalesProduct(id);
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'No se pudo eliminar el producto');
      }
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
    async (ing: PosIngredient) => {
      const stockProduct = ctx.products.find(p => p.id === ing.id);
      if (!stockProduct) return;
      const updated: StoreProduct = {
        ...stockProduct,
        name: ing.name,
        unit: ing.unit === 'kg' ? 'kg' : 'unidades',
        stockByWarehouse: stockProduct.stockByWarehouse.map((w, idx) =>
          idx === 0 ? { ...w, quantity: ing.stock } : w,
        ),
      };
      try {
        await ctx.updateProduct(updated, stockProduct);
      } catch (e) {
        setToast(e instanceof Error ? e.message : 'No se pudo guardar el ingrediente');
      }
    },
    [ctx],
  );

  const testPrinter = useCallback<VentasPosStore['testPrinter']>(
    async printer => {
      const result = await printingApi.testPrinter({ ip: printer.ip, port: printer.port });
      return result;
    },
    [printingApi],
  );

  const printTestTicket = useCallback<VentasPosStore['printTestTicket']>(
    async printer => {
      return printingApi.printTicket(buildTestTicketPayload(printer, ctx.ticketTemplate));
    },
    [printingApi, ctx.ticketTemplate],
  );

  const printerFingerprint = ctx.salesPrinters
    .map(p => `${p.id}:${p.ip}:${p.port}`)
    .join('|');
  const printerConnectedRef = useRef<Map<string, boolean>>(new Map());
  const printerMonitorReadyRef = useRef(false);

  useEffect(() => {
    if (printingApi.apiAvailable !== true || ctx.salesPrinters.length === 0) return;

    const printers = ctx.salesPrinters;
    printerMonitorReadyRef.current = false;
    for (const printer of printers) {
      if (!printerConnectedRef.current.has(printer.id)) {
        printerConnectedRef.current.set(printer.id, printer.connected);
      }
    }

    const checkPrinters = async () => {
      for (const printer of printers) {
        const prevConnected = printerConnectedRef.current.has(printer.id)
          ? printerConnectedRef.current.get(printer.id)!
          : printer.connected;

        const result = await testPrinter(printer);
        const connected = result.ok;
        ctx.updatePrinter(printer.id, { connected });

        if (printerMonitorReadyRef.current && prevConnected && !connected) {
          const label = printer.isDefault
            ? `La impresora predeterminada "${printer.name}" se desconectó`
            : `La impresora "${printer.name}" se desconectó`;
          setToast(`⚠️ ${label}`);
        }

        printerConnectedRef.current.set(printer.id, connected);
      }
      printerMonitorReadyRef.current = true;
    };

    void checkPrinters();
    const timer = window.setInterval(() => void checkPrinters(), 30_000);
    return () => window.clearInterval(timer);
  }, [printingApi.apiAvailable, printerFingerprint, testPrinter, ctx.updatePrinter, setToast]);

  const printToPrinter = useCallback<VentasPosStore['printToPrinter']>(
    async (ticket, printer) => {
      const template = ctx.ticketTemplate;
      const splits = splitTicketByStation(ticket);

      for (const split of splits) {
        const result = await printingApi.printTicket({
          ip: printer.ip,
          port: printer.port,
          paperWidth: printer.paperWidth,
          ticketNumber: split.number,
          createdAt: split.createdAt,
          items: split.items.map(i => ({
            name: i.name,
            quantity: i.qty,
            unitPrice: i.price,
          })),
          total: split.total,
          header: template.header,
          subheader: template.subheader,
          footer: template.footer,
          operatorName: split.operator,
          source: split.source,
          context: split.context,
          pickupStation: split.pickupStation || undefined,
          kind: split.kind,
          showDate: template.showDate,
          showOperator: template.showOperator,
          showItemDetails: template.showItemDetails,
          showLogo: template.showLogo,
        });
        if (!result.ok) return result;
      }

      return { ok: true };
    },
    [printingApi, ctx.ticketTemplate],
  );

  const value: VentasPosStore = {
    tickets,
    salesTickets: ctx.salesTickets,
    products: posProducts,
    ingredients,
    kitchens: ctx.kitchens,
    currentUser,
    apiOnline: salesApi.apiAvailable,
    saleBusy: salesApi.loading,
    toast,
    setToast,
    printTicket,
    voidTicket,
    replaceTicketItems,
    printReturn,
    salesCategories: ctx.salesCategories,
    salesCategoryEmojis: ctx.salesCategoryEmojis,
    addSalesCategory: ctx.addSalesCategory,
    saveProduct,
    deleteProduct,
    createKitchen: ctx.createKitchen,
    updateKitchen: ctx.updateKitchen,
    deleteKitchen: ctx.deleteKitchen,
    saveIngredient,
    printers: ctx.salesPrinters,
    addPrinter: ctx.addPrinter,
    updatePrinter: ctx.updatePrinter,
    removePrinter: ctx.removePrinter,
    setDefaultPrinter: ctx.setDefaultPrinter,
    togglePrinter: ctx.togglePrinter,
    testPrinter,
    printTestTicket,
    printToPrinter,
    template: ctx.ticketTemplate,
    updateTemplate: ctx.updateTicketTemplate,
    salesTables: ctx.salesTables,
    setSalesTables: ctx.setSalesTables,
    selectedTableId,
    setSelectedTableId,
    salesHistory: ctx.salesHistory,
    teamAccounts: ctx.teamAccounts,
    setTeamAccounts: ctx.setTeamAccounts,
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
