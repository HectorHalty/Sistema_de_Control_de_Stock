import { useState } from 'react';
import { useAppContext } from './AppContext';
import { ShoppingCart, AlertTriangle, TrendingUp, Clock, ChevronRight, ClipboardList, X } from 'lucide-react';
import { useNavigate } from 'react-router';
import logoIcon from '../../assets/logo-LCH.png';
import { getUnitLabel } from './store';
import type { AuditEntry } from './store';

export function DashboardPage() {
  const { products, warehouses, orders, auditLog, getTotalStock } = useAppContext();
  const navigate = useNavigate();
  const [selectedAudit, setSelectedAudit] = useState<AuditEntry | null>(null);

  const totalStock = products.reduce((sum, p) => sum + getTotalStock(p), 0);
  const pendingOrders = orders.filter(o => o.status === 'Pendiente').length;
  const lowStockProducts = products.filter(p => getTotalStock(p) < 20);

  const stats = [
    {
      label: 'Stock Total',
      value: `${totalStock} uds`,
      icon: TrendingUp,
      color: 'bg-blue-600',
      sub: `${products.length} productos`,
      to: '/productos',
    },
    {
      label: 'Registrar Consumo',
      value: warehouses.length,
      icon: ClipboardList,
      color: 'bg-amber-600',
      sub: 'Actualizar por almacén',
      to: '/consumo',
    },
    {
      label: 'Pedidos Pendientes',
      value: pendingOrders,
      icon: ShoppingCart,
      color: 'bg-purple-600',
      sub: `${orders.length} totales`,
      to: '/pedidos?status=Pendiente',
    },
    {
      label: 'Alertas',
      value: lowStockProducts.length,
      icon: AlertTriangle,
      color: lowStockProducts.length > 0 ? 'bg-red-600' : 'bg-green-600',
      sub: lowStockProducts.length > 0 ? 'Stock bajo' : 'Todo ok',
      to: '/reportes?tab=alertas',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Inicio</h1>
        <p className="text-muted-foreground text-sm mt-1">Resumen general del stock de La Chacra</p>
      </div>

      {/* Clickable stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map(stat => (
          <button
            key={stat.label}
            onClick={() => stat.to && navigate(stat.to)}
            className={`bg-card rounded-xl border border-border p-4 shadow-sm text-center transition-all ${stat.to ? 'hover:shadow-md hover:border-border/70 active:scale-95 cursor-pointer' : 'cursor-default'}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`${stat.color} p-2 rounded-lg`}>
                <stat.icon size={18} className="text-white" />
              </div>
              {stat.to && <ChevronRight size={16} className="text-muted-foreground" />}
            </div>
            <p className="text-base text-foreground" style={{ fontWeight: 600 }}>{stat.label}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{stat.value}</p>
            <p className="text-xs text-[#3d7a3d] mt-1" style={{ fontWeight: 500 }}>{stat.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={20} className="text-amber-600" />
            <h3 className="text-foreground">Alertas de Stock Bajo</h3>
          </div>
          {lowStockProducts.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-2">
                <AlertTriangle size={20} className="text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">Todo el stock está en niveles correctos ✓</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between py-2 px-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/40">
                  <div>
                    <p className="text-sm text-foreground" style={{ fontWeight: 500 }}>{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.category}</p>
                  </div>
                  <span className="text-sm text-red-700 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2.5 py-1 rounded-full" style={{ fontWeight: 600 }}>
                    {getTotalStock(p)} {getUnitLabel(p.unit, true)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={20} className="text-[#3d7a3d]" />
            <h3 className="text-foreground">Actividad Reciente</h3>
          </div>
          <div className="space-y-3">
            {auditLog.slice(0, 5).map(entry => (
              <button
                key={entry.id}
                onClick={() => setSelectedAudit(entry)}
                className="flex items-start gap-3 py-2 border-b border-border last:border-0 w-full text-left hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
              >
                <img src={logoIcon} alt="" className="logo-sidebar w-8 h-8 rounded-full flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span style={{ fontWeight: 500 }}>{entry.user}</span> – {entry.action}
                  </p>
                  <p className="text-xs text-muted-foreground">{entry.date}</p>
                </div>
                <ChevronRight size={14} className="text-muted-foreground mt-1 flex-shrink-0" />
              </button>
            ))}
            {auditLog.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Sin actividad reciente</p>}
          </div>
        </div>
      </div>

      {/* Audit Detail Modal */}
      {selectedAudit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAudit(null)}>
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h3 className="text-foreground">Detalle del Cambio</h3>
              <button onClick={() => setSelectedAudit(null)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="flex items-center gap-3">
                <img src={logoIcon} alt="" className="logo-sidebar w-10 h-10 rounded-full" />
                <div>
                  <p className="text-sm" style={{ fontWeight: 600 }}>{selectedAudit.user}</p>
                  <p className="text-xs text-muted-foreground">{selectedAudit.date}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Acción</p>
                  <p className="text-sm" style={{ fontWeight: 500 }}>{selectedAudit.action}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Elemento</p>
                  <p className="text-sm" style={{ fontWeight: 500 }}>{selectedAudit.element}</p>
                </div>
                {selectedAudit.previousValue && selectedAudit.previousValue !== '-' && (
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Valor anterior</p>
                        <p className="text-sm text-red-600" style={{ fontWeight: 500 }}>{selectedAudit.previousValue}</p>
                      </div>
                      <span className="text-muted-foreground text-lg">→</span>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Valor nuevo</p>
                        <p className="text-sm text-[#3d7a3d]" style={{ fontWeight: 500 }}>{selectedAudit.newValue || '-'}</p>
                      </div>
                    </div>
                  </div>
                )}
                {(!selectedAudit.previousValue || selectedAudit.previousValue === '-') && selectedAudit.newValue && selectedAudit.newValue !== '-' && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Detalle</p>
                    <p className="text-sm" style={{ fontWeight: 500 }}>{selectedAudit.newValue}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Almacenes quick view */}
      <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-foreground">Stock por Almacén</h3>
          <button onClick={() => navigate('/almacenes')} className="text-xs text-[#3d7a3d] hover:underline">Ver todos →</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {warehouses.map(w => {
            const totalUnits = products.reduce((sum, p) => {
              const stock = p.stockByWarehouse.find(s => s.warehouseId === w.id);
              return sum + (stock?.quantity || 0);
            }, 0);
            const totalProductTypes = products.filter(p => p.stockByWarehouse.some(s => s.warehouseId === w.id)).length;
            return (
              <button
                key={w.id}
                onClick={() => navigate('/almacenes')}
                className="border border-border/60 rounded-lg p-4 text-left hover:border-[#3d7a3d] hover:shadow-sm transition-all active:scale-95 bg-background/40"
              >
                <p className="text-sm" style={{ fontWeight: 500 }}>{w.name}</p>
                <p className="text-xs text-muted-foreground mb-3">{w.location}</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span><span style={{ fontWeight: 600 }} className="text-foreground">{totalProductTypes}</span> producto(s)</span>
                  <span><span style={{ fontWeight: 600 }} className="text-foreground">{totalUnits}</span> uds</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}