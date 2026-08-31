import { useCallback, useEffect, useState } from 'react';
import { footballApi, getAccessToken, type FootballOverview } from '@/app/api/client';

export function useFutbolOverview() {
  const [data, setData] = useState<FootballOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await footballApi.overview(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, loading, error, reload, torneoId: data?.torneo?.id ?? null };
}

export function futbolFieldClass(extra = '') {
  return `w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary ${extra}`.trim();
}

export function futbolButtonClass(variant: 'primary' | 'ghost' = 'primary') {
  if (variant === 'ghost') {
    return 'rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted';
  }
  return 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50';
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
      <h2 className="text-lg font-bold">{title}</h2>
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
