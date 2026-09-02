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
  return `w-full rounded-xl border border-border bg-input-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary ${extra}`.trim();
}

export function futbolButtonClass(variant: 'primary' | 'ghost' = 'primary') {
  if (variant === 'ghost') {
    return 'rounded-xl border border-border px-3 py-2 text-sm text-foreground hover:bg-muted';
  }
  return 'rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50';
}

export function FutbolPanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
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
