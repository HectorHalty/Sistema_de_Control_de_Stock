import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePublicAuth } from './auth/PublicAuthContext';
import { DniModal } from './auth/DniModal';
import { useCart } from './cart/CartContext';
import { publicApi } from '../../api/public-api';
import {
  FooterSponsors,
  MobileFooterSponsors,
  SidebarSponsors,
  usePublicSponsors,
} from './SponsorPlacements';
import {
  IconBookOpen,
  IconCamera,
  IconCart,
  IconFood,
  IconHome,
  IconReceipt,
  IconTrophy,
  IconUser,
} from './figma-icons';

type ScreenPath = string;

const SIDE_NAV: { path: ScreenPath; label: string; icon: ReactNode; match?: string[] }[] = [
  { path: '/', label: 'Inicio', icon: <IconHome /> },
  { path: '/torneo', label: 'Torneo', icon: <IconTrophy /> },
  { path: '/cantina', label: 'Comidas', icon: <IconFood />, match: ['/cantina', '/carrito', '/pago'] },
  { path: '/fotos', label: 'Fotos & Videos', icon: <IconCamera /> },
  { path: '/reglamento', label: 'Reglamento', icon: <IconBookOpen /> },
];

function isActive(path: string, navPath: string, match?: string[]) {
  if (match) return match.some((m) => path === m || path.startsWith(`${m}/`));
  if (navPath === '/') return path === '/';
  return path === navPath || path.startsWith(`${navPath}/`);
}

function displayName(email?: string | null) {
  if (!email) return 'Visitante';
  const local = email.split('@')[0] ?? email;
  return local.replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function Sidebar({
  path,
  cartCount,
  orderCount,
  sponsors,
}: {
  path: string;
  cartCount: number;
  orderCount: number;
  sponsors: import('../../api/public-api').PublicSponsor[];
}) {
  const navigate = useNavigate();
  const { user } = usePublicAuth();
  const pedidosActive = path === '/pedidos' || path === '/qr';
  const perfilActive = path === '/perfil' || path === '/administrar-equipo';
  const isComidaActive = ['/cantina', '/carrito', '/pago'].some(
    (m) => path === m || path.startsWith(`${m}/`),
  );

  return (
    <aside
      style={{ background: '#0e0e0e', width: 230, minWidth: 230 }}
      className="hidden h-full flex-col border-r border-[#1e1e1e] md:flex"
    >
      <div className="px-6 pb-4 pt-6">
        <div className="mb-1 flex items-center gap-3">
          <div
            style={{ background: '#1c1c1c', border: '2px solid #6BFF9E' }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#6BFF9E" strokeWidth="2" />
              <path
                d="M8 12l2.5 2.5L16 9"
                stroke="#6BFF9E"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <div style={{ color: '#6BFF9E' }} className="text-sm font-black leading-tight tracking-wide">
              LA CHACRA
            </div>
            <div style={{ color: '#6BFF9E' }} className="text-sm font-black leading-tight tracking-wide">
              FÚTBOL
            </div>
          </div>
        </div>
        <p className="ml-12 mt-1 text-[10px] text-gray-500">Elite Sports Complex</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 pt-2">
        {SIDE_NAV.map((item) => {
          const active = item.path === '/cantina' ? isComidaActive : isActive(path, item.path, item.match);
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              style={
                active ? { background: '#6BFF9E', color: '#0e0e0e' } : { color: '#9ca3af' }
              }
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all hover:text-white"
            >
              {item.icon}
              {item.label}
              {item.path === '/cantina' && cartCount > 0 && (
                <span
                  style={{
                    background: active ? '#0e0e0e' : '#6BFF9E',
                    color: active ? '#6BFF9E' : '#0e0e0e',
                  }}
                  className="ml-auto flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                >
                  {cartCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <SidebarSponsors sponsors={sponsors} />

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => navigate('/pedidos')}
          style={
            pedidosActive
              ? { background: '#6BFF9E', color: '#0e0e0e', border: 'none' }
              : { background: '#1c1c1c', color: 'white', border: '1px solid #2a2a2a' }
          }
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-all hover:text-white"
        >
          <IconReceipt />
          <span className="flex-1 text-left">Mis Pedidos</span>
          {orderCount > 0 && (
            <span
              style={{
                background: pedidosActive ? '#0e0e0e33' : '#6BFF9E',
                color: '#0e0e0e',
                borderRadius: 999,
                fontSize: 10,
                width: 20,
                height: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {orderCount > 9 ? '9+' : orderCount}
            </span>
          )}
        </button>
      </div>

      <button
        type="button"
        onClick={() => navigate('/perfil')}
        style={{
          borderTop: '1px solid #1e1e1e',
          background: perfilActive ? '#1c1c1c' : 'transparent',
        }}
        className="flex w-full items-center gap-3 px-4 pb-2 pt-3 text-left transition-colors hover:bg-[#1a1a1a]"
      >
        <div
          style={{ border: `2px solid ${perfilActive ? '#6BFF9E' : '#3a3a3a'}` }}
          className="h-8 w-8 shrink-0 overflow-hidden rounded-full"
        >
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[#242424] text-[10px] font-black text-[#6BFF9E]">
              {user ? displayName(user.email).slice(0, 2).toUpperCase() : 'LCH'}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p
            style={{ color: perfilActive ? '#6BFF9E' : 'white' }}
            className="truncate text-xs font-bold"
          >
            {displayName(user?.email)}
          </p>
          <p className="truncate text-[10px] text-gray-500">
            {user ? 'Ver mi perfil' : 'Iniciar sesión'}
          </p>
        </div>
        <span className="text-gray-500">
          <IconUser />
        </span>
      </button>
    </aside>
  );
}

export function PublicLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, token } = usePublicAuth();
  const { count } = useCart();

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  const path = location.pathname || '/';
  const hideMobileNav = ['/carrito', '/pago', '/qr', '/administrar-equipo'].includes(path);

  const { data: orders = [] } = useQuery({
    queryKey: ['public-orders', token],
    queryFn: () => publicApi.orders.list(token!),
    enabled: !!token,
  });
  const orderCount = orders.filter((o) => o.status !== 'retirado' && o.status !== 'cancelado').length;
  const { data: sponsors = [] } = usePublicSponsors();

  return (
    <div
      style={{ background: '#111111', display: 'flex', height: '100vh', overflow: 'hidden' }}
      className="text-white"
    >
      <Sidebar path={path} cartCount={count} orderCount={orderCount} sponsors={sponsors} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          style={{ background: '#111111', borderBottom: '1px solid #1e1e1e' }}
          className="flex items-center justify-between px-4 py-3 md:hidden"
        >
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#6BFF9E]">
              La Chacra Fútbol
            </p>
            <p className="text-sm font-black">{displayName(user?.email)}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/carrito')}
            style={{ background: '#1c1c1c', border: '1px solid #2a2a2a', position: 'relative' }}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-gray-300"
            aria-label="Ver carrito"
          >
            <IconCart />
            {count > 0 && (
              <span
                style={{
                  background: '#6BFF9E',
                  color: '#0e0e0e',
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 900,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {count}
              </span>
            )}
          </button>
        </header>

        <main style={{ flex: 1, overflowY: 'auto', background: '#111111' }} className="min-h-0 pb-20 md:pb-0">
          <Outlet />
        </main>

        <FooterSponsors sponsors={sponsors} />
        {!hideMobileNav && <MobileFooterSponsors sponsors={sponsors} />}

        {!hideMobileNav && (
          <nav
            style={{ background: '#0e0e0e', borderTop: '1px solid #1e1e1e' }}
            className="fixed bottom-0 left-0 right-0 z-30 md:hidden"
          >
            <div className="grid grid-cols-5 gap-1 px-1 py-2">
              {[
                { path: '/', label: 'Inicio', icon: <IconHome /> },
                { path: '/torneo', label: 'Torneo', icon: <IconTrophy /> },
                { path: '/cantina', label: 'Comidas', icon: <IconFood /> },
                { path: '/fotos', label: 'Fotos', icon: <IconCamera /> },
                { path: '/perfil', label: 'Perfil', icon: <IconUser /> },
              ].map((item) => {
                const active =
                  item.path === '/'
                    ? path === '/'
                    : path === item.path || path.startsWith(`${item.path}/`);
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => navigate(item.path)}
                    style={
                      active
                        ? { background: '#6BFF9E', color: '#0e0e0e' }
                        : { color: '#9ca3af' }
                    }
                    className="flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>

      <DniModal />
    </div>
  );
}
