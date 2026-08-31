import { useCallback, useEffect, useState } from 'react';
import { onlineApi, getAccessToken, type OnlineOverview } from '@/app/api/client';

export function useOnlineOverview() {
  const [data, setData] = useState<OnlineOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await onlineApi.overview(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload };
}

export function onlineFieldClass(extra = '') {
  return `w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${extra}`.trim();
}

export function onlineButtonClass(variant: 'primary' | 'ghost' = 'primary') {
  if (variant === 'ghost') {
    return 'rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted';
  }
  return 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50';
}

export function OnlinePanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </div>
  );
}

export function OnlineError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {message}
    </div>
  );
}

export const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'Preparando',
  ready: 'Listo',
  delivered: 'Entregado',
  en_cocina: 'En cocina',
  listo: 'Listo retiro',
  retirado: 'Retirado',
  pagado: 'Pagado',
};

export const NEXT_KITCHEN_STATUS: Record<string, string | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
};
