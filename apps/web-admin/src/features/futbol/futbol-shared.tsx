import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { footballApi, getAccessToken, type FootballOverview } from '@/app/api/client';

export function useFutbolOverview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const torneoIdParam = searchParams.get('torneoId') ?? '';
  const [data, setData] = useState<FootballOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await footballApi.overview(token, torneoIdParam || undefined));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [torneoIdParam]);

  useEffect(() => {
    void reload();
  }, [reload]);

  function setTorneoId(id: string) {
    const sp = new URLSearchParams(searchParams);
    if (id) sp.set('torneoId', id);
    else sp.delete('torneoId');
    setSearchParams(sp, { replace: true });
  }

  const torneoId = data?.torneo?.id ?? (torneoIdParam || null);

  return { data, loading, error, reload, torneoId, setTorneoId };
}

export function futbolFieldClass(extra = '') {
  return `w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 ${extra}`.trim();
}

export function futbolButtonClass(variant: 'primary' | 'ghost' = 'primary', extra = '') {
  const base =
    variant === 'ghost'
      ? 'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50'
      : 'inline-flex items-center gap-2 rounded-lg bg-[#3d7a3d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f5f2f] disabled:opacity-50';
  return `${base} ${extra}`.trim();
}

export function futbolCardClass(extra = '') {
  return `rounded-xl border border-border bg-card shadow-sm ${extra}`.trim();
}

export function FutbolPanelShell({
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

export function FutbolError({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-300">
      {message}
    </div>
  );
}

export function FutbolSuccess({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#3d7a3d]/30 bg-[#3d7a3d]/10 px-4 py-3 text-sm text-[#3d7a3d]">
      {message}
    </div>
  );
}

export async function openListaBuenaFe(inscripcionId: string) {
  const token = getAccessToken();
  if (!token) return;
  const res = await fetch(footballApi.roster.listaBuenaFeUrl(inscripcionId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('No se pudo generar la lista');
  const html = await res.text();
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
