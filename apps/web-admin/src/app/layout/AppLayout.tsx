import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  CircleDollarSign,
  ClipboardList,
  Home,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Trophy,
  UserMinus,
  Users,
  Warehouse,
} from 'lucide-react';
import { useAppContext } from '@/app/providers/AppContext';
import logoFull from '@/assets/baner-chacra.png';
import logoIcon from '@/assets/logo-LCH.png';
import { canAccessModule, getBottomNavModules, getInitials, getRoleLabel, getSidebarModules, shouldShowBottomNavigation, type ModuleId } from '@/features/platform/config/modules';
import { NotificationsMenu } from '@/features/platform/components/NotificationsMenu';

interface AppLayoutProps {
  onLogout: () => void;
}

const moduleMeta: Record<ModuleId, { label: string; to: string; icon: ComponentType<{ size?: number; className?: string }> }> = {
  dashboard: { label: 'Inicio', to: '/', icon: Home },
  stock: { label: 'Inventario', to: '/stock', icon: Warehouse },
  ventas: { label: 'Ventas', to: '/ventas', icon: CircleDollarSign },
  online: { label: 'Online', to: '/online', icon: ShoppingBag },
  futbol: { label: 'Futbol', to: '/futbol', icon: Trophy },
};

const stockInternalPaths = ['/productos', '/almacenes', '/pedidos', '/proveedores', '/consumo', '/registrar-consumo', '/reportes'];
const BOTTOM_NAV_IDLE_MS = 4000;

interface ContextNavItem {
  label: string;
  to: string;
  active: boolean;
  icon: ComponentType<{ size?: number; className?: string }>;
}

function buildContextNavItems(pathname: string, search: string, activeModule: ModuleId): ContextNavItem[] {
  if (activeModule === 'stock') {
    const stockRoutes = [
      { label: 'Inicio', to: '/stock', icon: Home },
      { label: 'Productos', to: '/productos', icon: Package },
      { label: 'Almacenes', to: '/almacenes', icon: Warehouse },
      { label: 'Pedidos', to: '/pedidos', icon: ShoppingCart },
      { label: 'Proveedores', to: '/proveedores', icon: Users },
      { label: 'Controlar Stock', to: '/consumo', icon: ClipboardList },
      { label: 'Registrar Consumo', to: '/registrar-consumo', icon: UserMinus },
      { label: 'Reportes', to: '/reportes', icon: BarChart3 },
    ];

    return stockRoutes.map(item => ({
      ...item,
      active: pathname === item.to,
    }));
  }

  const currentTab = new URLSearchParams(search).get('tab') || '';

  if (activeModule === 'ventas') {
    const selectedTab = currentTab === 'caja' ? 'mostrador' : currentTab || 'mostrador';
    const normalizedTab =
      selectedTab === 'metricas' || selectedTab === 'historial' ? 'reportes' : selectedTab;
    return [
      { key: 'inicio', label: 'Inicio', icon: Home },
      { key: 'mostrador', label: 'Mostrador', icon: CircleDollarSign },
      { key: 'pedidos', label: 'Mis Pedidos', icon: ShoppingCart },
      { key: 'devoluciones', label: 'Devoluciones', icon: RotateCcw },
      { key: 'productos', label: 'Productos', icon: Package },
      { key: 'mesas', label: 'Mesas', icon: Warehouse },
      { key: 'reportes', label: 'Reportes', icon: BarChart3 },
    ].map(item => ({
      label: item.label,
      to: item.key === 'reportes' ? '/ventas?tab=reportes&section=ventas' : `/ventas?tab=${item.key}`,
      active: pathname.startsWith('/ventas') && normalizedTab === item.key,
      icon: item.icon,
    }));
  }

  return [];
}

function getActiveModule(pathname: string): ModuleId {
  if (pathname === '/') return 'dashboard';
  if (pathname.startsWith('/stock') || stockInternalPaths.some(path => pathname.startsWith(path))) return 'stock';
  if (pathname.startsWith('/ventas')) return 'ventas';
  if (pathname.startsWith('/online')) return 'online';
  if (pathname.startsWith('/futbol')) return 'futbol';
  return 'dashboard';
}

function getTopbarTitle(pathname: string): string {
  if (pathname === '/') return 'Dashboard LCH';
  if (pathname.startsWith('/stock') || stockInternalPaths.some(path => pathname.startsWith(path))) return 'Modulo de Stock';
  if (pathname.startsWith('/ventas')) return 'Tickeo — Ventas';
  if (pathname.startsWith('/online')) return 'Ventas Online';
  if (pathname.startsWith('/futbol')) return 'Fútbol';
  if (pathname.startsWith('/configuracion')) return 'Configuracion';
  return 'LA CHACRA FUTBOL';
}

export function AppLayout({ onLogout }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [bottomNavCompact, setBottomNavCompact] = useState(false);
  const bottomNavIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { currentUser } = useAppContext();
  const location = useLocation();
  const navigate = useNavigate();

  const activeModule = getActiveModule(location.pathname);
  const topbarTitle = getTopbarTitle(location.pathname);
  const showBottomNavigation = shouldShowBottomNavigation(currentUser.role);
  const contextNavItems = buildContextNavItems(location.pathname, location.search, activeModule);

  const sidebarModules = useMemo(() => getSidebarModules(currentUser.role), [currentUser.role]);
  const bottomNavModules = useMemo(() => getBottomNavModules(currentUser.role), [currentUser.role]);
  const sidebarWidthClass = collapsed ? 'lg:w-[88px]' : 'lg:w-72';

  const clearBottomNavIdleTimer = useCallback(() => {
    if (bottomNavIdleTimer.current) {
      clearTimeout(bottomNavIdleTimer.current);
      bottomNavIdleTimer.current = null;
    }
  }, []);

  const startBottomNavIdleTimer = useCallback(() => {
    clearBottomNavIdleTimer();
    bottomNavIdleTimer.current = setTimeout(() => {
      setBottomNavCompact(true);
    }, BOTTOM_NAV_IDLE_MS);
  }, [clearBottomNavIdleTimer]);

  const expandBottomNav = useCallback(() => {
    setBottomNavCompact(false);
    clearBottomNavIdleTimer();
  }, [clearBottomNavIdleTimer]);

  useEffect(() => {
    if (!shouldShowBottomNavigation(currentUser.role)) return;
    expandBottomNav();
    startBottomNavIdleTimer();
    return clearBottomNavIdleTimer;
  }, [currentUser.role, location.pathname, location.search, expandBottomNav, startBottomNavIdleTimer, clearBottomNavIdleTimer]);

  const handleModuleNavigation = (moduleId: ModuleId) => {
    expandBottomNav();
    startBottomNavIdleTimer();
    const destination = moduleMeta[moduleId].to;
    if (moduleId !== 'dashboard' && !canAccessModule(currentUser.role, moduleId)) {
      navigate(destination, { replace: true });
      return;
    }
    navigate(destination);
  };

  const initials = getInitials(currentUser.username);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {drawerOpen && <button className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setDrawerOpen(false)} aria-label="Cerrar menu" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[360px] flex-col border-r border-border bg-card transition-all duration-200 ${sidebarWidthClass} ${drawerOpen ? 'translate-x-0' : '-translate-x-full'} lg:max-w-none lg:translate-x-0`}
      >
        <div className="border-b border-border px-4 pb-4 pt-5" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
          <NavLink to="/" className="flex items-center justify-center rounded-2xl bg-background px-3 py-3" onClick={() => setDrawerOpen(false)}>
            <img src={logoFull} alt="La Chacra Futbol" className={`logo-sidebar h-11 object-contain transition-all ${collapsed ? 'w-10' : 'w-52'}`} />
          </NavLink>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {contextNavItems.length > 0 ? (
            contextNavItems.map(item => (
              <button
                key={item.to}
                onClick={() => {
                  navigate(item.to);
                  setDrawerOpen(false);
                }}
                className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-[1.05rem] transition-colors ${item.active ? 'bg-[#3d7a3d] text-white' : 'text-foreground hover:bg-muted'}`}
              >
                <item.icon size={24} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            ))
          ) : (
            sidebarModules.map(moduleId => {
            const item = moduleMeta[moduleId];
            const Icon = item.icon;
            const active = activeModule === moduleId;
            const blocked = moduleId !== 'dashboard' && !canAccessModule(currentUser.role, moduleId);

            return (
              <button
                key={moduleId}
                onClick={() => {
                  handleModuleNavigation(moduleId);
                  setDrawerOpen(false);
                }}
                className={`flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-left text-[1.05rem] transition-colors ${active ? 'bg-[#3d7a3d] text-white' : 'text-foreground hover:bg-muted'} ${blocked ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <Icon size={24} />
                {!collapsed && <span>{item.label}</span>}
              </button>
            );
            })
          )}
        </nav>

        <div className="space-y-1 border-t border-border p-3">
          <NavLink
            to="/configuracion"
            onClick={() => setDrawerOpen(false)}
            className="flex items-center gap-4 rounded-2xl px-4 py-3 text-[1.05rem] text-foreground transition-colors hover:bg-muted"
          >
            <Settings size={24} />
            {!collapsed && <span>Configuracion</span>}
          </NavLink>

          <button
            onClick={onLogout}
            className="flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-[1.05rem] text-red-700 dark:text-red-400 transition-colors hover:bg-red-50 dark:hover:bg-red-950/40"
          >
            <LogOut size={24} />
            {!collapsed && <span>Cerrar Sesion</span>}
          </button>
        </div>
      </aside>

      <div className={`flex min-h-screen flex-col transition-all ${collapsed ? 'lg:pl-[88px]' : 'lg:pl-72'}`}>
        <header
          className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:px-6"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (window.matchMedia('(min-width: 1024px)').matches) {
                  setCollapsed(prev => !prev);
                } else {
                  setDrawerOpen(prev => !prev);
                }
              }}
              className="rounded-xl p-2 text-foreground hover:bg-muted"
              aria-label="Abrir menu"
            >
              <Menu size={22} />
            </button>
            <div className="hidden sm:block">
              <h2 className="text-foreground">{topbarTitle}</h2>
            </div>
            <div className="sm:hidden">
              <img src={logoFull} alt="La Chacra Futbol" className="logo-sidebar h-8 object-contain" />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="text-right">
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{getRoleLabel(currentUser.role)}</p>
              <p className="text-xs text-muted-foreground">{currentUser.username}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-9 w-9 rounded-full border-2 border-[#3d7a3d] bg-[#3d7a3d] flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            </div>
            <NotificationsMenu />
          </div>
        </header>

        <main className={`flex-1 overflow-auto p-4 lg:p-6 ${showBottomNavigation ? (bottomNavCompact ? 'pb-16' : 'pb-28') : ''}`}>
          <Outlet />
        </main>
      </div>

      {showBottomNavigation && bottomNavModules.length > 0 && (
        <nav
          aria-label="Navegación principal"
          onMouseEnter={expandBottomNav}
          onMouseLeave={startBottomNavIdleTimer}
          onTouchStart={expandBottomNav}
          onFocus={expandBottomNav}
          className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pt-2 backdrop-blur transition-transform duration-300 ease-out will-change-transform ${
            bottomNavCompact
              ? 'translate-y-[calc(100%-2.75rem)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)]'
              : 'translate-y-0 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]'
          } pb-[calc(env(safe-area-inset-bottom)+0.35rem)]`}
        >
          <div
            className={`mx-auto flex items-end justify-center gap-1 transition-all duration-300 ${
              bottomNavCompact ? 'max-w-xl' : ''
            }`}
            style={{ maxWidth: bottomNavCompact ? undefined : `${bottomNavModules.length * 72}px` }}
          >
            {bottomNavModules.map(moduleId => {
              const item = moduleMeta[moduleId];
              const Icon = item.icon;
              const active = activeModule === moduleId;
              const isCenter = moduleId === 'dashboard';

              return (
                <button
                  key={moduleId}
                  type="button"
                  onClick={() => handleModuleNavigation(moduleId)}
                  className={`relative flex flex-col items-center justify-center rounded-xl px-2 text-[11px] transition-all duration-300 ${
                    isCenter
                      ? bottomNavCompact
                        ? 'h-11 w-11 rounded-full border-2 border-background bg-[#3d7a3d] text-white'
                        : '-mt-7 h-16 w-16 justify-center rounded-full border-4 border-background bg-[#3d7a3d] text-white py-1.5'
                      : `min-w-[56px] ${bottomNavCompact ? 'h-10 py-1' : 'h-12 py-1.5'} ${active ? 'text-[#3d7a3d]' : 'text-muted-foreground'}`
                  }`}
                >
                  <Icon size={isCenter ? (bottomNavCompact ? 18 : 20) : (bottomNavCompact ? 15 : 16)} />
                  {!isCenter && (
                    <span
                      className={`overflow-hidden transition-all duration-300 ${
                        bottomNavCompact ? 'max-h-0 opacity-0' : 'max-h-5 opacity-100'
                      }`}
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
