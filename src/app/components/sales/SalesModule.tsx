import { useMemo, useState, useCallback, useRef } from 'react';
import { Search, Plus, X, Edit, Trash2, RotateCcw, Wallet, ClipboardList, Package, TableProperties, BarChart3, Ticket, History, Home, ChevronLeft, ChevronRight, Printer, AlertTriangle, WifiOff } from 'lucide-react';
import { useSearchParams } from 'react-router';
import { useAppContext } from '../AppContext';
import type { SalesProduct, SalesTicket, SalesTable, Kitchen, SalesHistoryEntry } from '../store';
import { roundUpToOrderUnit } from '../store';
import { createKitchenOrdersFromTicket } from '../kitchen/domain';
import { useSalesApiAdapter } from '../../api/adapters';
import {
  deductStockForSale,
  getMaxSellableUnits,
  isSalesProductAvailable,
  restoreStockForTicket,
  validateStockForCart,
} from './stock-link';
import { SalesProductsPanel } from './SalesProductsPanel';

type SalesTab = 'inicio' | 'caja' | 'pedidos' | 'devoluciones' | 'productos' | 'mesas' | 'metricas' | 'reportes' | 'historial';

interface CartItem {
  salesProductId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  kitchenId: string;
  kitchenName: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);
}

export function SalesModule() {
  const { products, setProducts, currentUser, addSalesAudit, kitchens, setKitchens, salesProducts, setSalesProducts, salesTickets, setSalesTickets, salesTicketCounter, setSalesTicketCounter, salesTables, setSalesTables, salesHistory, setSalesHistory, kitchenOrders, setKitchenOrders } = useAppContext();
  const salesApi = useSalesApiAdapter();
  const [searchParams] = useSearchParams();

  const currentTab = searchParams.get('tab');
  const tab = (['caja', 'pedidos', 'devoluciones', 'productos', 'mesas', 'metricas', 'reportes', 'historial'].includes(currentTab || '')
    ? currentTab
    : 'inicio') as SalesTab;

  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [kitchenFilter, setKitchenFilter] = useState<string>('Todas');
  const [message, setMessage] = useState('');
  const [editingTicket, setEditingTicket] = useState<SalesTicket | null>(null);
  const [showReturnConfirm, setShowReturnConfirm] = useState<string | null>(null);
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedTableForCash, setSelectedTableForCash] = useState<string | null>(null);
  const [showReturnPrint, setShowReturnPrint] = useState<SalesTicket | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // --- Derived data ---
  const categories = useMemo(() => ['Todas', ...Array.from(new Set(salesProducts.map(p => p.category).filter(Boolean)))], [salesProducts]);
  const activeKitchens = useMemo(() => kitchens.filter(k => k.active), [kitchens]);

  const filteredProducts = useMemo(() => {
    return salesProducts.filter(item => {
      if (!item.active) return false;
      const categoryMatch = categoryFilter === 'Todas' || item.category === categoryFilter;
      const kitchenMatch = kitchenFilter === 'Todas' || item.kitchenId === kitchenFilter;
      const searchMatch = item.name.toLowerCase().includes(search.toLowerCase());
      // Check stock availability
      const hasStock = isSalesProductAvailable(item, products);
      return categoryMatch && kitchenMatch && searchMatch && hasStock;
    });
  }, [salesProducts, categoryFilter, kitchenFilter, search, products]);

  const unavailableProducts = useMemo(() => {
    return salesProducts.filter(item => {
      if (!item.active) return false;
      const searchMatch = item.name.toLowerCase().includes(search.toLowerCase());
      const categoryMatch = categoryFilter === 'Todas' || item.category === categoryFilter;
      const kitchenMatch = kitchenFilter === 'Todas' || item.kitchenId === kitchenFilter;
      return categoryMatch && kitchenMatch && searchMatch && !isSalesProductAvailable(item, products);
    });
  }, [salesProducts, search, products, categoryFilter, kitchenFilter]);

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const latestTicket = useMemo(() => {
    return salesTickets.filter(t => t.status === 'emitido').sort((a, b) =>
      new Date(b.createdAtISO).getTime() - new Date(a.createdAtISO).getTime()
    )[0] || null;
  }, [salesTickets]);

  const metrics = useMemo(() => {
    const issuedTickets = salesTickets.filter(t => t.status === 'emitido');
    const totalSales = issuedTickets.reduce((sum, t) => sum + t.total, 0);
    const totalItems = issuedTickets.reduce((sum, t) => sum + t.items.reduce((a, i) => a + i.quantity, 0), 0);
    const canceledTickets = salesTickets.filter(t => t.status === 'anulado');
    const returnedTickets = salesTickets.filter(t => t.status === 'devuelto');

    const byProduct: Record<string, number> = {};
    const byKitchen: Record<string, number> = {};
    issuedTickets.forEach(ticket => {
      ticket.items.forEach(item => {
        byProduct[item.name] = (byProduct[item.name] || 0) + item.quantity;
        byKitchen[item.kitchenId] = (byKitchen[item.kitchenId] || 0) + item.unitPrice * item.quantity;
      });
    });

    const topProducts = Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Daily breakdown for last 7 days
    const dailySales: { date: string; total: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayTotal = issuedTickets
        .filter(t => t.createdAtISO.startsWith(dateStr))
        .reduce((sum, t) => sum + t.total, 0);
      dailySales.push({ date: dateStr, total: dayTotal });
    }

    return { totalSales, totalItems, topProducts, byKitchen, canceledTickets: canceledTickets.length, returnedTickets: returnedTickets.length, dailySales };
  }, [salesTickets]);

  // --- Cart actions ---
  const getCartQuantity = useCallback(
    (salesProductId: string) => cart.find(item => item.salesProductId === salesProductId)?.quantity ?? 0,
    [cart],
  );

  const addToCart = (menuProduct: SalesProduct) => {
    const maxUnits = getMaxSellableUnits(menuProduct, products);
    if (maxUnits <= 0) {
      setMessage(`"${menuProduct.name}" no tiene stock disponible. Configurá su receta en Productos de venta.`);
      return;
    }

    const kitchen = kitchens.find(k => k.id === menuProduct.kitchenId);
    const currentQty = getCartQuantity(menuProduct.id);
    if (currentQty >= maxUnits) {
      setMessage(`Stock máximo para "${menuProduct.name}": ${maxUnits} unidad(es).`);
      return;
    }

    setCart(prev => {
      const current = prev.find(item => item.salesProductId === menuProduct.id);
      if (current) {
        return prev.map(item =>
          item.salesProductId === menuProduct.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          salesProductId: menuProduct.id,
          name: menuProduct.name,
          unitPrice: menuProduct.price,
          quantity: 1,
          kitchenId: menuProduct.kitchenId,
          kitchenName: kitchen?.name || '',
        },
      ];
    });
    setMessage('');
  };

  const updateQuantity = (salesProductId: string, delta: number) => {
    const salesProduct = salesProducts.find(p => p.id === salesProductId);
    if (!salesProduct) return;

    const maxUnits = getMaxSellableUnits(salesProduct, products);
    setCart(prev => {
      const next = prev
        .map(item => {
          if (item.salesProductId !== salesProductId) return item;
          const nextQty = Math.max(0, item.quantity + delta);
          if (nextQty > maxUnits) {
            setMessage(`Stock máximo para "${salesProduct.name}": ${maxUnits} unidad(es).`);
            return { ...item, quantity: Math.min(item.quantity, maxUnits) };
          }
          return { ...item, quantity: nextQty };
        })
        .filter(item => item.quantity > 0);

      return next;
    });
  };

  const removeFromCart = (salesProductId: string) => {
    setCart(prev => prev.filter(item => item.salesProductId !== salesProductId));
  };

  const checkout = async () => {
    if (cart.length === 0) {
      setMessage('Agrega productos para registrar la venta.');
      return;
    }

    // Race condition protection: re-validate against current stock
    const validation = validateStockForCart(cart, salesProducts, products);
    if (!validation.ok) {
      const missingText = validation.missing.map(m => `${m.name} (${m.available}/${m.required})`).join(', ');
      setMessage(`No hay stock suficiente: ${missingText}.`);
      return;
    }

    // API-first: try server-side transactional checkout
    if (salesApi.apiAvailable) {
      const idempotencyKey = `checkout-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const apiResult = await salesApi.checkout({
        items: cart.map(item => ({ salesProductId: item.salesProductId, quantity: item.quantity })),
        operatorId: currentUser.username,
        note: selectedTableForCash ? `Mesa: ${salesTables.find(t => t.id === selectedTableForCash)?.name}` : undefined,
        idempotencyKey,
      });

      if (apiResult.ok && 'result' in apiResult) {
        // API succeeded — sync local state from server response
        const ticket = apiResult.result.ticket;
        const cartSnapshot = [...cart];
        setProducts(prev => deductStockForSale(prev, cartSnapshot, salesProducts));
        setSalesTickets(prev => [{
          id: ticket.id,
          number: ticket.number,
          createdAtISO: ticket.createdAt,
          status: ticket.status,
          items: ticket.items.map((i: any) => ({
            salesProductId: i.salesProductId,
            name: i.name,
            unitPrice: Number(i.unitPrice),
            quantity: i.quantity,
            kitchenId: salesProducts.find(sp => sp.id === i.salesProductId)?.kitchenId || '',
          })),
          total: Number(ticket.total),
          operatorId: currentUser.username,
          operatorName: currentUser.username,
          note: ticket.note,
        }, ...prev]);
        setSalesTicketCounter(ticket.number);
        setCart([]);
        setSelectedTableForCash(null);
        setMessage(`Venta registrada (#${ticket.number}) por ${formatCurrency(Number(ticket.total))}.`);
        return;
      }
      // API failed but is available — show error
      if (!apiResult.apiUnavailable && 'error' in apiResult) {
        setMessage(`Error en venta: ${apiResult.error}`);
        return;
      }
    }

    // Fallback: localStorage-only checkout
    const nextCounter = salesTicketCounter + 1;
    const selectedTable = selectedTableForCash ? salesTables.find(t => t.id === selectedTableForCash) : null;
    const newTicket: SalesTicket = {
      id: `sale-${Date.now()}`,
      number: nextCounter,
      createdAtISO: new Date().toISOString(),
      status: 'emitido',
      items: cart.map(item => ({
        salesProductId: item.salesProductId,
        name: item.name,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        kitchenId: item.kitchenId,
      })),
      total: cartTotal,
      operatorId: currentUser.username,
      operatorName: currentUser.username,
      note: selectedTable ? `Mesa: ${selectedTable.name}` : undefined,
    };

    setProducts(prev => deductStockForSale(prev, cart, salesProducts));
    setSalesTickets(prev => [newTicket, ...prev]);
    setSalesTicketCounter(nextCounter);

    // If from a table, mark it as occupied and create kitchen orders
    if (selectedTable) {
      setSalesTables(prev => prev.map(t => t.id === selectedTable.id ? { ...t, status: 'ocupada' as const, currentOrderId: newTicket.id } : t));

      // Create kitchen orders from this ticket
      const kitchenOrders = createKitchenOrdersFromTicket(newTicket, salesProducts, kitchens, selectedTable.id, selectedTable.name);
      setKitchenOrders(prev => [...kitchenOrders, ...prev]);
    }

    // Add history entry
    const historyEntry: SalesHistoryEntry = {
      id: `h-${Date.now()}`,
      timestampISO: new Date().toISOString(),
      operatorId: currentUser.username,
      operatorName: currentUser.username,
      type: 'venta',
      detail: `Venta #${nextCounter} - ${cart.length} producto(s) - ${formatCurrency(cartTotal)}${selectedTable ? ` (${selectedTable.name})` : ''}`,
      ticketId: newTicket.id,
    };
    setSalesHistory(prev => [historyEntry, ...prev]);

    addSalesAudit({
      user: currentUser.username,
      action: `Venta registrada #${nextCounter}`,
      element: `Ticket ${nextCounter}`,
      previousValue: '-',
      newValue: `${cart.length} item(s)`,
    });

    setCart([]);
    setSelectedTableForCash(null);
    setMessage(`Venta registrada (#${newTicket.number}) por ${formatCurrency(newTicket.total)}${selectedTable ? ` - ${selectedTable.name}` : ''}.`);
  };

  const handleCancelTicket = (ticket: SalesTicket) => {
    if (ticket.status !== 'emitido') return;
    setProducts(prev => restoreStockForTicket(prev, ticket, salesProducts));
    setSalesTickets(prev => prev.map(t => (t.id === ticket.id ? { ...t, status: 'anulado' } : t)));
    setMessage(`Ticket #${ticket.number} anulado. Stock reintegrado.`);

    const historyEntry: SalesHistoryEntry = {
      id: `h-${Date.now()}`,
      timestampISO: new Date().toISOString(),
      operatorId: currentUser.username,
      operatorName: currentUser.username,
      type: 'anulacion',
      detail: `Anulacion ticket #${ticket.number}`,
      ticketId: ticket.id,
    };
    setSalesHistory(prev => [historyEntry, ...prev]);

    addSalesAudit({
      user: currentUser.username,
      action: `Anulacion ticket #${ticket.number}`,
      element: `Ticket ${ticket.number}`,
      previousValue: 'emitido',
      newValue: 'anulado',
    });
  };

  const handleReturnTicket = async (ticket: SalesTicket) => {
    if (ticket.status !== 'emitido') return;

    // API-first: try server-side return
    if (salesApi.apiAvailable) {
      const idempotencyKey = `return-${ticket.id}-${Date.now()}`;
      const apiResult = await salesApi.returnSale({
        ticketId: ticket.id,
        operatorId: currentUser.username,
        idempotencyKey,
      });

      if (apiResult.ok && 'result' in apiResult) {
        setProducts(prev => restoreStockForTicket(prev, ticket, salesProducts));
        setSalesTickets(prev => prev.map(t => (t.id === ticket.id ? { ...t, status: 'devuelto' } : t)));
        setMessage(`Devolucion aplicada sobre ticket #${ticket.number}. Stock reintegrado.`);

        const historyEntry: SalesHistoryEntry = {
          id: `h-${Date.now()}`,
          timestampISO: new Date().toISOString(),
          operatorId: currentUser.username,
          operatorName: currentUser.username,
          type: 'devolucion',
          detail: `Devolucion ticket #${ticket.number}`,
          ticketId: ticket.id,
        };
        setSalesHistory(prev => [historyEntry, ...prev]);
        addSalesAudit({
          user: currentUser.username,
          action: `Devolucion ticket #${ticket.number}`,
          element: `Ticket ${ticket.number}`,
          previousValue: 'emitido',
          newValue: 'devuelto',
        });
        return;
      } else if (!apiResult.apiUnavailable && 'error' in apiResult) {
        setMessage(`Error en devolucion: ${apiResult.error}`);
        return;
      }
      // If apiUnavailable, fall through to localStorage
    }

    // Fallback: localStorage-only return
    setProducts(prev => restoreStockForTicket(prev, ticket, salesProducts));
    setSalesTickets(prev => prev.map(t => (t.id === ticket.id ? { ...t, status: 'devuelto' } : t)));
    setMessage(`Devolucion aplicada sobre ticket #${ticket.number}. Stock reintegrado.`);

    const historyEntry: SalesHistoryEntry = {
      id: `h-${Date.now()}`,
      timestampISO: new Date().toISOString(),
      operatorId: currentUser.username,
      operatorName: currentUser.username,
      type: 'devolucion',
      detail: `Devolucion ticket #${ticket.number}`,
      ticketId: ticket.id,
    };
    setSalesHistory(prev => [historyEntry, ...prev]);

    addSalesAudit({
      user: currentUser.username,
      action: `Devolucion ticket #${ticket.number}`,
      element: `Ticket ${ticket.number}`,
      previousValue: 'emitido',
      newValue: 'devuelto',
    });
  };

  const handleEditTicket = (ticket: SalesTicket) => {
    // Restore stock first, then load items back into cart
    setProducts(prev => restoreStockForTicket(prev, ticket, salesProducts));
    setSalesTickets(prev => prev.filter(t => t.id !== ticket.id));
    setCart(ticket.items.map(item => ({
      salesProductId: item.salesProductId,
      name: item.name,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      kitchenId: item.kitchenId,
      kitchenName: kitchens.find(k => k.id === item.kitchenId)?.name || '',
    })));
    setEditingTicket(ticket);
    setMessage(`Editando ticket #${ticket.number}. Stock temporalmente reintegrado.`);
  };

  const handleDeleteTicket = (ticket: SalesTicket) => {
    if (ticket.status !== 'emitido') return;
    setProducts(prev => restoreStockForTicket(prev, ticket, salesProducts));
    setSalesTickets(prev => prev.filter(t => t.id !== ticket.id));
    setMessage(`Ticket #${ticket.number} eliminado. Stock reintegrado.`);

    const historyEntry: SalesHistoryEntry = {
      id: `h-${Date.now()}`,
      timestampISO: new Date().toISOString(),
      operatorId: currentUser.username,
      operatorName: currentUser.username,
      type: 'anulacion',
      detail: `Eliminacion ticket #${ticket.number}`,
      ticketId: ticket.id,
    };
    setSalesHistory(prev => [historyEntry, ...prev]);
  };

  const handlePrintReturnTicket = (ticket: SalesTicket) => {
    setShowReturnPrint(ticket);
    setTimeout(() => {
      window.print();
      setShowReturnPrint(null);
    }, 300);
  };

  const handleOpenTableCash = (tableId: string) => {
    setSelectedTableForCash(tableId);
    setCart([]);
    setSearch('');
    // Navigate to caja tab
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'caja');
    window.location.hash = `#/ventas?${params.toString()}`;
  };

  // --- Report data ---
  const reportData = useMemo(() => {
    const dayTickets = salesTickets.filter(t => {
      if (t.status !== 'emitido') return false;
      return t.createdAtISO.startsWith(reportDate);
    });

    const byKitchen: Record<string, { items: { name: string; qty: number; unitPrice: number; total: number }[]; kitchenTotal: number }> = {};

    dayTickets.forEach(ticket => {
      ticket.items.forEach(item => {
        if (!byKitchen[item.kitchenId]) {
          byKitchen[item.kitchenId] = { items: [], kitchenTotal: 0 };
        }
        const lineTotal = item.unitPrice * item.quantity;
        byKitchen[item.kitchenId].items.push({
          name: item.name,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          total: lineTotal,
        });
        byKitchen[item.kitchenId].kitchenTotal += lineTotal;
      });
    });

    return byKitchen;
  }, [salesTickets, reportDate]);

  const reportGrandTotal = useMemo(() => {
    return Object.values(reportData).reduce((sum, k) => sum + k.kitchenTotal, 0);
  }, [reportData]);

  // --- Render ---
  return (
    <div className="space-y-4">
      {message && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage('')} className="ml-2 text-muted-foreground hover:text-foreground"><X size={14} /></button>
        </div>
      )}

      {/* API availability indicator */}
      {salesApi.apiAvailable === false && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-700 flex items-center gap-2">
          <WifiOff size={14} />
          <span>Modo offline — los cambios se guardan localmente hasta que el servidor este disponible.</span>
        </div>
      )}
      {salesApi.loading && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs text-blue-700">
          Procesando en el servidor...
        </div>
      )}

      {tab === 'inicio' && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Ventas del dia</p>
            <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(metrics.totalSales)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Tickets emitidos</p>
            <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{salesTickets.filter(t => t.status === 'emitido').length}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-sm text-muted-foreground">Items vendidos</p>
            <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{metrics.totalItems}</p>
          </div>
        </div>
      )}

      {tab === 'caja' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
            {/* Table context banner */}
            {selectedTableForCash && (
              <div className="rounded-xl border border-[#3d7a3d] bg-[#3d7a3d]/5 px-4 py-2 flex items-center justify-between">
                <span className="text-sm" style={{ fontWeight: 600 }}>
                  🍽️ {salesTables.find(t => t.id === selectedTableForCash)?.name}
                </span>
                <button
                  onClick={() => setSelectedTableForCash(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cambiar mesa
                </button>
              </div>
            )}
            {/* Search + Category + Kitchen filters */}
            <div className="flex flex-col gap-2 md:flex-row">
              <div className="relative flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Buscar producto..."
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 outline-none focus:border-[#3d7a3d]"
                />
              </div>
              <select
                value={categoryFilter}
                onChange={event => setCategoryFilter(event.target.value)}
                className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d]"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Kitchen selectors */}
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setKitchenFilter('Todas')}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${kitchenFilter === 'Todas' ? 'bg-[#3d7a3d] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
              >
                Todas
              </button>
              {activeKitchens.map(k => (
                <button
                  key={k.id}
                  onClick={() => setKitchenFilter(k.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${kitchenFilter === k.id ? 'bg-[#3d7a3d] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                >
                  {k.emoji} {k.name}
                </button>
              ))}
            </div>

            {/* Product grid */}
            <div className="grid gap-2 md:grid-cols-2">
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  onClick={() => addToCart(product)}
                  className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2 text-left transition-colors hover:border-[#3d7a3d]"
                >
                  <span className="text-2xl">{product.emoji}</span>
                  <span className="flex-1">
                    <span className="block text-sm text-foreground" style={{ fontWeight: 600 }}>{product.name}</span>
                    <span className="text-xs text-muted-foreground">{product.category}</span>
                  </span>
                  <span className="text-sm text-[#2f5f2f]">{formatCurrency(product.price)}</span>
                </button>
              ))}
            </div>

            {/* Unavailable products */}
            {unavailableProducts.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                <p className="text-xs text-red-700 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Sin stock disponible:</p>
                <div className="flex gap-2 flex-wrap">
                  {unavailableProducts.map(p => (
                    <span key={p.id} className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded-full">{p.emoji} {p.name}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Cart sidebar */}
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <h3 className="mb-3 text-foreground">Comanda actual</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {cart.length === 0 && <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Todavia no hay productos agregados.</p>}
              {cart.map(item => (
                <div key={item.salesProductId} className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.kitchenName} • {formatCurrency(item.unitPrice)} c/u</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <button onClick={() => updateQuantity(item.salesProductId, -1)} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-sm">-</button>
                    <span className="w-6 text-center text-sm">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.salesProductId, 1)} className="h-7 w-7 rounded-lg border border-border flex items-center justify-center text-sm">+</button>
                    <button onClick={() => removeFromCart(item.salesProductId)} className="h-7 w-7 rounded-lg border border-red-200 text-red-600 flex items-center justify-center text-xs ml-1"><X size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(cartTotal)}</span>
              </div>
              <button onClick={checkout} className="w-full rounded-xl bg-[#3d7a3d] py-2.5 text-sm text-white transition-colors hover:bg-[#2f5f2f]">
                Confirmar venta
              </button>
            </div>

            {/* Latest order quick access */}
            {latestTicket && (
              <div className="mt-4 border-t border-border pt-3">
                <p className="text-xs text-muted-foreground mb-2">Ultima venta:</p>
                <div className="rounded-xl bg-muted p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Ticket #{latestTicket.number}</p>
                    <p className="text-sm text-[#2f5f2f]">{formatCurrency(latestTicket.total)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(latestTicket.createdAtISO).toLocaleString('es-AR')}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleEditTicket(latestTicket)}
                      className="flex-1 text-xs bg-blue-100 text-blue-700 py-1.5 rounded-lg hover:bg-blue-200"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleCancelTicket(latestTicket)}
                      className="flex-1 text-xs bg-red-100 text-red-700 py-1.5 rounded-lg hover:bg-red-200"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'pedidos' && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-foreground">Mis Pedidos</h3>
          <div className="space-y-2">
            {salesTickets.filter(t => t.status === 'emitido').length === 0 && <p className="text-sm text-muted-foreground">Todavia no hay pedidos registrados.</p>}
            {salesTickets.filter(t => t.status === 'emitido').map(ticket => (
              <article key={ticket.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Ticket #{ticket.number}</p>
                  <p className="text-sm text-[#2f5f2f]">{formatCurrency(ticket.total)}</p>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(ticket.createdAtISO).toLocaleString('es-AR')} • {ticket.items.length} producto(s)</p>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => handleEditTicket(ticket)}
                    className="text-xs bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-200 flex items-center gap-1"
                  >
                    <Edit size={12} /> Editar
                  </button>
                  <button
                    onClick={() => handleDeleteTicket(ticket)}
                    className="text-xs bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200 flex items-center gap-1"
                  >
                    <Trash2 size={12} /> Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      {tab === 'devoluciones' && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-foreground">Devoluciones</h3>
          <p className="text-xs text-muted-foreground mb-3">Selecciona un ticket para aplicar devolucion. Se reintegra stock y se resta del total.</p>
          <div className="space-y-2">
            {salesTickets.filter(t => t.status === 'emitido').length === 0 && <p className="text-sm text-muted-foreground">No hay tickets para devolver.</p>}
            {salesTickets.filter(t => t.status === 'emitido').map(ticket => (
              <div key={ticket.id} className="flex items-center justify-between rounded-xl border border-border bg-background p-3">
                <div>
                  <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>Ticket #{ticket.number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(ticket.createdAtISO).toLocaleString('es-AR')} • {formatCurrency(ticket.total)}</p>
                  <p className="text-xs text-muted-foreground">{ticket.items.map(i => `${i.name} x${i.quantity}`).join(', ')}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePrintReturnTicket(ticket)}
                    className="rounded-xl border border-blue-200 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                  >
                    <Printer size={12} /> Imprimir
                  </button>
                  <button
                    onClick={() => handleReturnTicket(ticket)}
                    className="rounded-xl border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50 flex items-center gap-1"
                  >
                    <RotateCcw size={12} /> Devolver
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'productos' && (
        <SalesProductsPanel
          salesProducts={salesProducts}
          setSalesProducts={setSalesProducts}
          stockProducts={products}
          kitchens={kitchens}
          setKitchens={setKitchens}
          apiOnline={salesApi.apiAvailable}
          onNotify={setMessage}
        />
      )}

      {tab === 'mesas' && (
        <div className="space-y-4">
          {selectedTableForCash && (
            <div className="rounded-xl border border-[#3d7a3d] bg-[#3d7a3d]/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">🍽️</span>
                <span className="text-sm" style={{ fontWeight: 600 }}>
                  Tomando pedido para: {salesTables.find(t => t.id === selectedTableForCash)?.name}
                </span>
                <span className="text-xs text-muted-foreground">({cart.length} items en comanda)</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // Save current order as ticket for this table
                    if (cart.length > 0) {
                      checkout();
                    }
                    setSelectedTableForCash(null);
                  }}
                  className="text-xs bg-[#3d7a3d] text-white px-3 py-1.5 rounded-lg hover:bg-[#2f5f2f]"
                >
                  Guardar y Cerrar
                </button>
                <button
                  onClick={() => {
                    setCart([]);
                    setSelectedTableForCash(null);
                  }}
                  className="text-xs bg-muted text-muted-foreground px-3 py-1.5 rounded-lg hover:bg-muted/80"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <h3 className="text-foreground">Mesas</h3>
            <button
              onClick={() => {
                const name = prompt('Nombre de la mesa (ej: Mesa 7):');
                if (name?.trim()) {
                  setSalesTables(prev => [...prev, { id: `t-${Date.now()}`, name: name.trim(), status: 'libre' }]);
                }
              }}
              className="text-xs bg-[#3d7a3d] text-white px-3 py-1.5 rounded-lg hover:bg-[#2f5f2f] flex items-center gap-1"
            >
              <Plus size={12} /> Nueva Mesa
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
            {salesTables.map(table => {
              const isSelected = selectedTableForCash === table.id;
              return (
                <button
                  key={table.id}
                  onClick={() => {
                    if (table.status === 'libre' && !selectedTableForCash) {
                      setSalesTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'ocupada' } : t));
                    }
                    handleOpenTableCash(table.id);
                  }}
                  className={`rounded-2xl border-2 p-6 text-center transition-all hover:shadow-md ${
                    isSelected
                      ? 'border-[#3d7a3d] bg-[#3d7a3d]/10 ring-2 ring-[#3d7a3d]/30'
                      : table.status === 'libre'
                      ? 'border-green-300 bg-green-50 hover:border-green-400'
                      : 'border-amber-300 bg-amber-50 hover:border-amber-400'
                  }`}
                >
                  <p className="text-3xl mb-2">{table.status === 'libre' ? '🪑' : '🍽️'}</p>
                  <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{table.name}</p>
                  <p className={`text-xs mt-1 ${table.status === 'libre' ? 'text-green-700' : 'text-amber-700'}`}>
                    {isSelected ? 'Seleccionada' : table.status === 'libre' ? 'Libre' : 'Ocupada'}
                  </p>
                  {table.status === 'ocupada' && !isSelected && (
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setSalesTables(prev => prev.map(t => t.id === table.id ? { ...t, status: 'libre', currentOrderId: undefined } : t));
                      }}
                      className="mt-2 text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200"
                    >
                      Liberar
                    </button>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'metricas' && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Ventas totales</p>
              <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{formatCurrency(metrics.totalSales)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Tickets emitidos</p>
              <p className="text-2xl text-foreground" style={{ fontWeight: 700 }}>{salesTickets.filter(t => t.status === 'emitido').length}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Cancelados</p>
              <p className="text-2xl text-red-600" style={{ fontWeight: 700 }}>{metrics.canceledTickets}</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">Devoluciones</p>
              <p className="text-2xl text-amber-600" style={{ fontWeight: 700 }}>{metrics.returnedTickets}</p>
            </div>
          </div>

          {/* Daily sales chart */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-4 text-foreground">Ventas ultimos 7 dias</h3>
            <div className="flex items-end gap-2 h-40">
              {metrics.dailySales.map((day, i) => {
                const maxVal = Math.max(...metrics.dailySales.map(d => d.total), 1);
                const height = (day.total / maxVal) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full bg-[#3d7a3d]/20 rounded-t" style={{ height: `${Math.max(height, 2)}%` }}>
                      <div className="w-full bg-[#3d7a3d] rounded-t transition-all" style={{ height: `${Math.max(height, 2)}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{day.date.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* By kitchen */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-foreground">Ventas por Cocina</h3>
            <div className="space-y-2">
              {Object.entries(metrics.byKitchen).map(([kitchenId, total]) => {
                const kitchen = kitchens.find(k => k.id === kitchenId);
                return (
                  <div key={kitchenId} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                    <span className="text-sm text-foreground">{kitchen?.emoji} {kitchen?.name || kitchenId}</span>
                    <span className="text-sm text-[#2f5f2f]" style={{ fontWeight: 600 }}>{formatCurrency(total)}</span>
                  </div>
                );
              })}
              {Object.keys(metrics.byKitchen).length === 0 && <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>}
            </div>
          </div>

          {/* Top products */}
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="mb-3 text-foreground">Top Productos</h3>
            <div className="space-y-2">
              {metrics.topProducts.map(([name, sold]) => (
                <div key={name} className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
                  <span className="text-sm text-foreground">{name}</span>
                  <span className="text-sm text-[#2f5f2f]">{sold} uds</span>
                </div>
              ))}
              {metrics.topProducts.length === 0 && <p className="text-sm text-muted-foreground">Sin datos suficientes.</p>}
            </div>
          </div>
        </div>
      )}

      {tab === 'reportes' && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-foreground">Reporte por Fecha</h3>
            <input
              type="date"
              value={reportDate}
              onChange={e => setReportDate(e.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-[#3d7a3d] text-sm"
            />
          </div>

          {Object.keys(reportData).length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No hay ventas para la fecha seleccionada.</p>
          )}

          {Object.entries(reportData).map(([kitchenId, data]) => {
            const kitchen = kitchens.find(k => k.id === kitchenId);
            return (
              <div key={kitchenId} className="rounded-xl border border-border overflow-hidden">
                <div className="bg-[#3d7a3d]/10 px-4 py-2 flex items-center justify-between">
                  <h4 className="text-sm text-[#3d7a3d]" style={{ fontWeight: 600 }}>{kitchen?.emoji} {kitchen?.name || kitchenId}</h4>
                  <span className="text-sm text-[#3d7a3d]" style={{ fontWeight: 700 }}>{formatCurrency(data.kitchenTotal)}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted">
                      <th className="text-left px-3 py-2 text-xs text-muted-foreground">Producto</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground">Cant</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground">Precio Unit.</th>
                      <th className="text-right px-3 py-2 text-xs text-muted-foreground">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((item, i) => (
                      <tr key={i} className="border-b border-border/40">
                        <td className="px-3 py-2">{item.name}</td>
                        <td className="px-3 py-2 text-right">{item.qty}</td>
                        <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2 text-right" style={{ fontWeight: 500 }}>{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}

          {Object.keys(reportData).length > 0 && (
            <div className="rounded-xl border-2 border-[#3d7a3d] bg-[#3d7a3d]/5 px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-foreground" style={{ fontWeight: 600 }}>Total General</span>
              <span className="text-lg text-[#3d7a3d]" style={{ fontWeight: 700 }}>{formatCurrency(reportGrandTotal)}</span>
            </div>
          )}

          <button
            onClick={() => window.print()}
            className="w-full rounded-xl bg-[#3d7a3d] py-2.5 text-sm text-white transition-colors hover:bg-[#2f5f2f] flex items-center justify-center gap-2"
          >
            <Printer size={14} /> Imprimir Reporte
          </button>
        </div>
      )}

      {tab === 'historial' && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="mb-3 text-foreground">Historial de Actividad</h3>
          {salesHistory.length === 0 && <p className="text-sm text-muted-foreground">Aun no hay actividad registrada.</p>}
          {/* Group by operator */}
          {Object.entries(
            salesHistory.reduce((acc, entry) => {
              const key = entry.operatorName;
              if (!acc[key]) acc[key] = [];
              acc[key].push(entry);
              return acc;
            }, {} as Record<string, SalesHistoryEntry[]>)
          ).map(([operator, entries]) => (
            <div key={operator} className="mb-4">
              <h4 className="text-sm text-foreground mb-2 flex items-center gap-2" style={{ fontWeight: 600 }}>
                <div className="h-6 w-6 rounded-full bg-[#3d7a3d] flex items-center justify-center text-white text-[10px] font-bold">
                  {operator.slice(0, 2).toUpperCase()}
                </div>
                {operator}
              </h4>
              <div className="space-y-1 ml-8">
                {entries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      entry.type === 'venta' ? 'bg-green-500' :
                      entry.type === 'anulacion' ? 'bg-red-500' :
                      entry.type === 'devolucion' ? 'bg-amber-500' :
                      'bg-blue-500'
                    }`} />
                    <span className="text-muted-foreground">{new Date(entry.timestampISO).toLocaleString('es-AR')}</span>
                    <span className="text-foreground">{entry.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Return Ticket Print Template */}
      {showReturnPrint && (
        <div ref={printRef} className="fixed inset-0 z-[100] bg-white print:static print:z-auto">
          <div className="max-w-md mx-auto p-8 print:p-4">
            {/* Print-only header */}
            <div className="text-center mb-6 print:mb-4">
              <div className="w-16 h-16 bg-[#3d7a3d] rounded-full flex items-center justify-center mx-auto mb-3 print:w-12 print:h-12">
                <span className="text-white text-xl font-bold print:text-lg">LCH</span>
              </div>
              <h1 className="text-2xl font-bold text-[#3d7a3d] print:text-xl">La Chacra Futbol</h1>
              <p className="text-sm text-gray-500">Control de Stock</p>
            </div>

            {/* DEVOLUCION heading */}
            <div className="bg-red-50 border-2 border-red-300 rounded-lg px-6 py-4 mb-6 print:mb-4">
              <h2 className="text-3xl font-black text-red-600 text-center print:text-2xl">DEVOLUCION</h2>
              <p className="text-center text-red-500 text-sm mt-1">Comprobante de Devolucion de Mercaderia</p>
            </div>

            {/* Ticket info */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6 print:mb-4 print:p-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-500 text-xs uppercase">Ticket Original</span>
                  <p className="font-bold">#{showReturnPrint.number}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">Fecha</span>
                  <p className="font-bold">{new Date(showReturnPrint.createdAtISO).toLocaleDateString('es-AR')}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">Operador</span>
                  <p className="font-bold">{showReturnPrint.operatorName}</p>
                </div>
                <div>
                  <span className="text-gray-500 text-xs uppercase">Total Devuelto</span>
                  <p className="font-bold text-red-600">{formatCurrency(showReturnPrint.total)}</p>
                </div>
              </div>
            </div>

            {/* Items table */}
            <table className="w-full text-sm mb-6 print:mb-4">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-3 py-2 text-xs text-gray-500 uppercase">Producto</th>
                  <th className="text-center px-3 py-2 text-xs text-gray-500 uppercase">Cant</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Precio Unit.</th>
                  <th className="text-right px-3 py-2 text-xs text-gray-500 uppercase">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {showReturnPrint.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2 text-center">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.unitPrice * item.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-red-50">
                  <td colSpan={3} className="px-3 py-3 text-right font-bold text-red-600">Total Devuelto:</td>
                  <td className="px-3 py-3 text-right font-bold text-red-600 text-lg">{formatCurrency(showReturnPrint.total)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 border-t border-gray-200 pt-4 print:pt-3">
              <p>Stock reintegrado automaticamente al deposito principal.</p>
              <p className="mt-1">Generado el {new Date().toLocaleString('es-AR')}</p>
            </div>

            {/* Print controls (hidden when printing) */}
            <div className="flex gap-3 justify-center mt-6 no-print">
              <button
                onClick={() => setShowReturnPrint(null)}
                className="px-6 py-2.5 rounded-lg bg-[#3d7a3d] text-white text-sm hover:bg-[#2f5f2f]"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

