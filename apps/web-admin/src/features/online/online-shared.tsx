import { useQuery } from '@tanstack/react-query';
import { onlineApi, getAccessToken } from '@/app/api/client';

export function useOnlineOverview() {
  const query = useQuery({
    queryKey: ['online', 'overview'],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) throw new Error('Sesión requerida');
      return onlineApi.overview(token);
    },
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error instanceof Error ? query.error.message : 'Error al cargar') : null,
    reload: () => {
      void query.refetch();
    },
  };
}

export function onlineFieldClass(extra = '') {
  return `w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 ${extra}`.trim();
}

export function onlineButtonClass(variant: 'primary' | 'ghost' = 'primary', extra = '') {
  const base =
    variant === 'ghost'
      ? 'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50'
      : 'inline-flex items-center gap-2 rounded-lg bg-[#3d7a3d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f5f2f] disabled:opacity-50';
  return `${base} ${extra}`.trim();
}

export function onlineCardClass(extra = '') {
  return `rounded-xl border border-border bg-card shadow-sm ${extra}`.trim();
}

export function OnlinePanelShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 pb-20 lg:pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
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
