import { Navigate } from 'react-router-dom';
import { usePublicAuth } from './auth/PublicAuthContext';
import { PageLoader } from '../ui/PageLoader';

export function CaptainRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = usePublicAuth();

  if (loading) return <PageLoader />;

  if (!user) {
    return <Navigate to="/perfil" replace />;
  }

  if (user.rol !== 'capitan') {
    return <Navigate to="/perfil" replace />;
  }

  return <>{children}</>;
}
