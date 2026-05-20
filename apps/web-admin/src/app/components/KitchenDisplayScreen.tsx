import { useMemo, useState, useEffect, useCallback } from 'react';
import { useAppContext } from './AppContext';
import type { KitchenOrder, KitchenOrderStatus } from '../store';
import { transitionKitchenOrder } from './kitchen/domain';
import { useKitchenApiAdapter } from '../api/adapters';
import { Clock, CheckCircle, Package, AlertCircle, Bell, WifiOff, RefreshCw } from 'lucide-react';

const statusConfig: Record<KitchenOrderStatus, { label: string; color: string; bg: string; icon: typeof Clock; nextStatus?: KitchenOrderStatus; nextLabel?: string }> = {
  pending: { label: 'Pendiente', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: Clock, nextStatus: 'preparing', nextLabel: 'Preparar' },
  preparing: { label: 'Preparando', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: AlertCircle, nextStatus: 'ready', nextLabel: 'Listo' },
  ready: { label: 'Listo', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle, nextStatus: 'delivered', nextLabel: 'Entregado' },
  delivered: { label: 'Entregado', color: 'text-gray-500', bg: 'bg-gray-50 border-gray-200', icon: Package },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function minutesAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

export function KitchenDisplayScreen() {
  const { kitchenOrders, setKitchenOrders, kitchens, salesTables } = useAppContext();
  const kitchenApi = useKitchenApiAdapter();
  const [filter, setFilter] = useState<KitchenOrderStatus | 'all'>('all');
  const [kitchenFilter, setKitchenFilter] = useState<string>('all');
  const [audioAlert, setAudioAlert] = useState(false);

  // Auto-refresh every 30 seconds (fallback when SSE not available)
  useEffect(() => {
    const interval = setInterval(() => {
      setAudioAlert(prev => prev);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeKitchens = useMemo(() => kitchens.filter(k => k.active), [kitchens]);

  // API-first: use SSE-driven orders when API available, fallback to localStorage
  const displayOrders = kitchenApi.apiAvailable ? kitchenApi.orders : kitchenOrders;

  const filteredOrders = useMemo(() => {
    let orders = [...displayOrders];

    if (filter !== 'all') {
      orders = orders.filter(o => o.status === filter);
    }

    if (kitchenFilter !== 'all') {
      orders = orders.filter(o => o.kitchenId === kitchenFilter);
    }

    const statusPriority: Record<KitchenOrderStatus, number> = {
      pending: 0,
      preparing: 1,
      ready: 2,
      delivered: 3,
    };

    return orders.sort((a, b) => {
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(a.createdAtISO || a.createdAt).getTime() - new Date(b.createdAtISO || b.createdAt).getTime();
    });
  }, [displayOrders, filter, kitchenFilter]);

  const counts = useMemo(() => {
    const result: Record<KitchenOrderStatus | 'all', number> = { all: displayOrders.length, pending: 0, preparing: 0, ready: 0, delivered: 0 };
    displayOrders.forEach(o => { result[o.status]++; });
    return result;
  }, [displayOrders]);

  const handleTransition = useCallback(async (orderId: string, nextStatus: KitchenOrderStatus) => {
    // API-first: try server-side transition
    if (kitchenApi.apiAvailable) {
      const result = await kitchenApi.transitionOrder(orderId, nextStatus);
      if (result.ok && !result.apiUnavailable) {
        // SSE will refresh orders automatically
        return;
      }
      // API failed — fall through to localStorage
    }

    // Fallback: localStorage-only transition
    setKitchenOrders(prev => {
      const order = prev.find(o => o.id === orderId);
      if (!order) return prev;
      try {
        const updated = transitionKitchenOrder(order, nextStatus);
        return prev.map(o => o.id === orderId ? updated : o);
      } catch {
        return prev;
      }
    });
  }, [kitchenApi, setKitchenOrders]);

  const pendingCount = counts.pending;
  const readyCount = counts.ready;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-foreground flex items-center gap-2">
            <Bell size={20} className="text-[#3d7a3d]" />
            Pantalla de Cocina
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {pendingCount > 0 && <span className="text-amber-600">{pendingCount} pendiente(s)</span>}
            {pendingCount > 0 && readyCount > 0 && <span className="mx-1">·</span>}
            {readyCount > 0 && <span className="text-green-600">{readyCount} listo(s) para retirar</span>}
          </p>
        </div>

        {/* Status indicators */}
        <div className="flex items-center gap-2">
          {kitchenApi.apiAvailable === false && (
            <span className="text-xs text-amber-600 flex items-center gap-1">
              <WifiOff size={12} /> Offline
            </span>
          )}
          {kitchenApi.apiAvailable === true && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <RefreshCw size={12} className={kitchenApi.loading ? 'animate-spin' : ''} /> Live
            </span>
          )}
        </div>

        {/* Kitchen filter */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setKitchenFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${kitchenFilter === 'all' ? 'bg-[#3d7a3d] text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
          >
            Todas las cocinas
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
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'preparing', 'ready', 'delivered'] as const).map(status => {
          const config = status === 'all'
            ? { label: 'Todos', count: counts.all, color: '', bg: '' }
            : { label: statusConfig[status].label, count: counts[status], color: statusConfig[status].color, bg: statusConfig[status].bg };
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors border ${
                filter === status
                  ? 'bg-[#3d7a3d] text-white border-[#3d7a3d]'
                  : `bg-card text-muted-foreground border-border hover:bg-muted`
              }`}
            >
              {config.label} ({config.count})
            </button>
          );
        })}
      </div>

      {/* Orders grid */}
      {filteredOrders.length === 0 && (
        <div className="text-center py-16 text-muted-foreground bg-card rounded-xl border border-border">
          <Package size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg">No hay órdenes {filter !== 'all' ? `en estado "${statusConfig[filter]?.label}"` : ''}</p>
          <p className="text-sm mt-1">Las órdenes aparecerán aquí cuando se registren ventas.</p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {filteredOrders.map(order => {
          const config = statusConfig[order.status];
          const Icon = config.icon;
          const elapsed = minutesAgo(order.createdAtISO || order.createdAt);
          const isUrgent = order.status === 'pending' && elapsed > 10;

          return (
            <div
              key={order.id}
              className={`rounded-xl border-2 p-4 shadow-sm transition-all ${config.bg} ${isUrgent ? 'animate-pulse border-amber-400' : ''}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Icon size={18} className={config.color} />
                  <span className="text-sm" style={{ fontWeight: 700 }}>Ticket #{order.ticketNumber}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${config.color} ${config.bg}`}>
                  {config.label}
                </span>
              </div>

              {/* Table / Operator info */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                {order.tableName && (
                  <span className="bg-muted px-2 py-1 rounded">{order.tableName}</span>
                )}
                <span>{order.operatorName}</span>
                <span>· {formatTime(order.createdAtISO || order.createdAt)}</span>
                {elapsed > 5 && (
                  <span className="text-amber-600">({elapsed} min)</span>
                )}
              </div>

              {/* Items */}
              <div className="space-y-1 mb-4">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.emoji}</span>
                      <span className="text-sm text-foreground">{item.name}</span>
                    </div>
                    <span className="text-sm" style={{ fontWeight: 700 }}>x{item.quantity}</span>
                  </div>
                ))}
              </div>

              {/* Action button */}
              {config.nextStatus && (
                <button
                  onClick={() => handleTransition(order.id, config.nextStatus!)}
                  disabled={kitchenApi.loading}
                  className={`w-full rounded-lg py-2 text-sm text-white transition-colors ${
                    kitchenApi.loading ? 'opacity-50 cursor-not-allowed' : ''
                  } ${
                    order.status === 'pending'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : order.status === 'preparing'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-gray-600 hover:bg-gray-700'
                  }`}
                >
                  {config.nextLabel}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
