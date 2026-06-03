import { useMemo, useState, type ComponentType } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import {
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  ClipboardList,
  Globe,
  Goal,
  History,
  Home,
  Image,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Star,
  Table2,
  TableProperties,
  Ticket,
  Trophy,
  Truck,
  UserMinus,
  Users,
  Wallet,
  Warehouse,
} from 'lucide-react';
import { useAppContext } from './AppContext';
import logoFull from '../../assets/baner-chacra.png';
import logoIcon from '../../assets/logo-LCH.png';
import { canAccessModule, getBottomNavModules, getInitials, getRoleLabel, getSidebarModules, shouldShowBottomNavigation, type ModuleId } from './platformAccess';

interface AppLayoutProps {
  onLogout: () => void;
}

const moduleMeta: Record<ModuleId, { label: string; to: string; icon: ComponentType<{ size?: number; className?: string }> }> = {
  dashboard: { label: 'Inicio', to: '/', icon: Home },
  stock: { label: 'Stock', to: '/stock', icon: Warehouse },
  ventas: { label: 'Ventas', to: '/ventas', icon: CircleDollarSign },
  online: { label: 'Online', to: '/online', icon: ShoppingBag },
  futbol: { label: 'Futbol', to: '/futbol', icon: Trophy },
};

const stockInternalPaths = ['/productos', '/almacenes', '/pedidos', '/proveedores', '/consumo', '/registrar-consumo', '/reportes'];

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
    const selectedTab = currentTab || 'inicio';
    return [
      { key: 'inicio', label: 'Inicio', icon: Home },
      { key: 'caja', label: 'Caja', icon: Wallet },
      { key: 'pedidos', label: 'Mis Pedidos', icon: ClipboardList },
      { key: 'devoluciones', label: 'Devoluciones', icon: RotateCcw },
      { key: 'productos', label: 'Productos', icon: Package },
      { key: 'mesas', label: 'Mesas', icon: TableProperties },
      { key: 'metricas', label: 'Metricas', icon: BarChart3 },
      { key: 'reportes', label: 'Reportes', icon: Ticket },
      { key: 'historial', label: 'Historial', icon: History },
    ].map(item => ({
      label: item.label,
      to: `/ventas?tab=${item.key}`,
      active: pathname.startsWith('/ventas') && selectedTab === item.key,
      icon: item.icon,
    }));
  }

  if (activeModule === 'online') {
    const selectedTab = currentTab || 'resumen';
    return [
      { key: 'resumen', label: 'Resumen', icon: BarChart3 },
      { key: 'productos', label: 'Productos', icon: Package },
      { key: 'sponsors', label: 'Sponsors', icon: Star },
      { key: 'media', label: 'Multimedia', icon: Image },
      { key: 'catalogo', label: 'Catalogo', icon: ShoppingBag },
      { key: 'carrito', label: 'Carrito', icon: ShoppingCart },
      { key: 'pedidos', label: 'Pedidos', icon: Truck },
      { key: 'integracion', label: 'Integracion', icon: Globe },
    ].map(item => ({
      label: item.label,
      to: `/online?tab=${item.key}`,
      active: pathname.startsWith('/online') && selectedTab === item.key,
      icon: item.icon,
    }));
  }

  if (activeModule === 'futbol') {
    const selectedTab = currentTab || 'fixture';
    return [
      { key: 'fixture', label: 'Fixture', icon: CalendarRange },
      { key: 'partidos', label: 'Partidos', icon: ClipboardList },
      { key: 'equipos', label: 'Equipos', icon: Users },
      { key: 'jugadores', label: 'Jugadores', icon: Trophy },
      { key: 'suspendidos', label: 'Suspendidos', icon: ShieldCheck },
      { key: 'reglamento', label: 'Reglamento', icon: Table2 },
      { key: 'avisos', label: 'Avisos', icon: Goal },
      { key: 'media', label: 'Multimedia', icon: Image },
    ].map(item => ({
      label: item.label,
      to: `/futbol?tab=${item.key}`,
      active: pathname.startsWith('/futbol') && selectedTab === item.key,
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
  if (pathname.startsWith('/ventas')) return 'Modulo de Ventas Fisicas';
  if (pathname.startsWith('/online')) return 'Modulo de Ventas Online';
  if (pathname.startsWith('/futbol')) return 'Modulo de Futbol';
  if (pathname.startsWith('/configuracion')) return 'Configuracion';
  return 'LA CHACRA FUTBOL';
}

export function AppLayout({ onLogout }: AppLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
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

  const handleModuleNavigation = (moduleId: ModuleId) => {
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
            className="flex w-full items-center gap-4 rounded-2xl px-4 py-3 text-[1.05rem] text-red-700 transition-colors hover:bg-red-50"
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

          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm text-foreground" style={{ fontWeight: 600 }}>{getRoleLabel(currentUser.role)}</p>
              <p className="text-xs text-muted-foreground">{currentUser.username}</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="h-9 w-9 rounded-full border-2 border-[#3d7a3d] bg-[#3d7a3d] flex items-center justify-center text-white text-xs font-bold">
                {initials}
              </div>
            </div>
          </div>
        </header>

        <main className={`flex-1 overflow-auto p-4 lg:p-6 ${showBottomNavigation ? 'pb-28 lg:pb-24' : ''}`}>
          <Outlet />
        </main>
      </div>

      {showBottomNavigation && bottomNavModules.length > 0 && (
        <nav className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.35rem)] pt-2 backdrop-blur lg:inset-x-auto lg:bottom-4 lg:right-4 lg:rounded-2xl lg:border lg:shadow-xl ${collapsed ? 'lg:left-[104px]' : 'lg:left-[304px]'}`}>
          <div className="mx-auto flex items-end justify-center gap-1" style={{ maxWidth: `${bottomNavModules.length * 72}px` }}>
            {bottomNavModules.map(moduleId => {
              const item = moduleMeta[moduleId];
              const Icon = item.icon;
              const active = activeModule === moduleId;
              const isCenter = moduleId === 'dashboard';

              return (
                <button
                  key={moduleId}
                  onClick={() => handleModuleNavigation(moduleId)}
                  className={`relative flex flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[11px] transition-all ${
                    isCenter
                      ? `-mt-7 h-16 w-16 justify-center rounded-full border-4 border-background bg-[#3d7a3d] text-white`
                      : `h-12 min-w-[56px] ${active ? 'text-[#3d7a3d]' : 'text-muted-foreground'}`
                  }`}
                >
                  <Icon size={isCenter ? 20 : 16} />
                  {!isCenter && <span>{item.label}</span>}
                </button>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
