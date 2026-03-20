import { useState } from 'react';
import { NavLink, Outlet } from 'react-router';
import { LayoutDashboard, Package, Warehouse, ShoppingCart, BarChart3, Settings, LogOut, Menu, ClipboardList, Users } from 'lucide-react';
import { useAppContext } from './AppContext';
import logoFull from '../../assets/baner-chacra.png';
import logoIcon from '../../assets/logo-LCH.png';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Inicio' },
  { to: '/productos', icon: Package, label: 'Productos' },
  { to: '/almacenes', icon: Warehouse, label: 'Almacenes' },
  { to: '/pedidos', icon: ShoppingCart, label: 'Pedidos' },
  { to: '/proveedores', icon: Users, label: 'Proveedores' },
  { to: '/consumo', icon: ClipboardList, label: 'Registrar Consumo' },
  { to: '/reportes', icon: BarChart3, label: 'Reportes' },
  { to: '/configuracion', icon: Settings, label: 'Configuración' },
];

interface AppLayoutProps {
  onLogout: () => void;
}

export function AppLayout({ onLogout }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { currentUser } = useAppContext();

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-border" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 1rem)' }}>
          <NavLink to="/" className="flex items-center gap-2">
            <img src={logoFull} alt="La Chacra Fútbol" className="logo-sidebar h-10 object-contain" />
          </NavLink>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                  ? 'bg-[#3d7a3d] text-white'
                  : 'text-foreground hover:bg-muted'
                }`
              }
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <button
            onClick={onLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-foreground hover:bg-red-50 hover:text-red-600 w-full transition-colors"
          >
            <LogOut size={20} />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="bg-card border-b border-border px-4 lg:px-6 py-3 flex items-center justify-between sticky top-0 z-30" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted text-foreground"
          >
            <Menu size={22} />
          </button>

          <div className="lg:hidden">
            <img src={logoFull} alt="La Chacra" className="logo-sidebar h-8 object-contain" />
          </div>

          <div className="flex items-center gap-3 ml-auto">
            <div className="hidden sm:block text-right">
              <p className="text-sm text-foreground leading-tight" style={{ fontWeight: 500 }}>{currentUser.username}</p>
              <p className="text-xs text-muted-foreground leading-tight">{currentUser.role}</p>
            </div>
            <img src={logoIcon} alt="Usuario" className="logo-sidebar w-9 h-9 rounded-full object-cover border-2 border-[#3d7a3d]" />
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}