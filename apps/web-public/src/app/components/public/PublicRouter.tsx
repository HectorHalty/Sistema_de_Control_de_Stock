import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PublicLayout } from './PublicLayout';
import { PageLoader } from '../ui/PageLoader';

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const TorneoPage = lazy(() => import('./pages/TorneoPage').then((m) => ({ default: m.TorneoPage })));
const CantinaPage = lazy(() => import('./pages/CantinaPage').then((m) => ({ default: m.CantinaPage })));
const CartPage = lazy(() => import('./pages/CartPage').then((m) => ({ default: m.CartPage })));
const PaymentPage = lazy(() => import('./pages/PaymentPage').then((m) => ({ default: m.PaymentPage })));
const OrdersPage = lazy(() => import('./pages/OrdersPage').then((m) => ({ default: m.OrdersPage })));
const QrPage = lazy(() => import('./pages/QrPage').then((m) => ({ default: m.QrPage })));
const FotosPage = lazy(() => import('./pages/FotosPage').then((m) => ({ default: m.FotosPage })));
const ReglamentoPage = lazy(() =>
  import('./pages/ReglamentoPage').then((m) => ({ default: m.ReglamentoPage })),
);
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })));
const CaptainTeamPage = lazy(() =>
  import('./pages/CaptainTeamPage').then((m) => ({ default: m.CaptainTeamPage })),
);

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export function PublicRouter() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<Lazy><HomePage /></Lazy>} />
          <Route path="torneo" element={<Lazy><TorneoPage /></Lazy>} />
          <Route path="cantina" element={<Lazy><CantinaPage /></Lazy>} />
          <Route path="carrito" element={<Lazy><CartPage /></Lazy>} />
          <Route path="pago" element={<Lazy><PaymentPage /></Lazy>} />
          <Route path="pedidos" element={<Lazy><OrdersPage /></Lazy>} />
          <Route path="qr" element={<Lazy><QrPage /></Lazy>} />
          <Route path="fotos" element={<Lazy><FotosPage /></Lazy>} />
          <Route path="reglamento" element={<Lazy><ReglamentoPage /></Lazy>} />
          <Route path="perfil" element={<Lazy><ProfilePage /></Lazy>} />
          <Route path="administrar-equipo" element={<Lazy><CaptainTeamPage /></Lazy>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
