import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { Trophy, Users, Calendar, Shield, Globe, GlobeLock, Layers } from 'lucide-react';
import { footballApi, getAccessToken } from '@/app/api/client';
import {
  FutbolError,
  FutbolPanelShell,
  futbolButtonClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';

export function FutbolInicioPanel() {
  const { data, loading, error, reload, setTorneoId } = useFutbolOverview();
  const [, setSearchParams] = useSearchParams();
  const [toggling, setToggling] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function togglePublicado() {
    const token = getAccessToken();
    if (!token || !data?.torneo) return;
    setToggling(true);
    setActionError(null);
    try {
      await footballApi.updateTorneo(
        data.torneo.id,
        { publicado: !data.torneo.publicado },
        token,
      );
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo actualizar');
    } finally {
      setToggling(false);
    }
  }

  async function bootstrapAll() {
    const token = getAccessToken();
    if (!token) return;
    setBootstrapping(true);
    setActionError(null);
    setSuccess(null);
    try {
      const result = await footballApi.bootstrapTorneos(token);
      setSuccess(`Listo — ${result.created} torneos activos en el campeonato.`);
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'No se pudo inicializar torneos');
    } finally {
      setBootstrapping(false);
    }
  }

  if (loading) return <FutbolPanelShell title="Torneo">Cargando...</FutbolPanelShell>;
  if (error) return <FutbolPanelShell title="Torneo"><FutbolError message={error} /></FutbolPanelShell>;

  const torneos = data?.torneos ?? [];

  if (!data?.torneo && !torneos.length) {
    return (
      <FutbolPanelShell title="Torneo">
        <p className="text-sm text-muted-foreground">No hay torneos configurados.</p>
        <button
          type="button"
          className={`${futbolButtonClass()} mt-3`}
          disabled={bootstrapping}
          onClick={() => void bootstrapAll()}
        >
          {bootstrapping ? 'Creando...' : 'Inicializar 8 categorías (Apertura)'}
        </button>
        {actionError && <div className="mt-3"><FutbolError message={actionError} /></div>}
      </FutbolPanelShell>
    );
  }

  const { torneo, stats } = data!;
  const cards = [
    { label: 'Equipos', value: stats?.equipos ?? 0, icon: Users },
    { label: 'Partidos', value: stats?.partidos ?? 0, icon: Calendar },
    { label: 'Capitanes', value: stats?.capitanes ?? 0, icon: Shield },
    { label: 'Jornadas', value: stats?.jornadas ?? 0, icon: Trophy },
  ];

  return (
    <FutbolPanelShell title="Torneo activo">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Categoría / torneo
          </label>
          <select
            className={futbolFieldClass()}
            value={torneo?.id ?? ''}
            onChange={(e) => setTorneoId(e.target.value)}
          >
            {torneos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
                {t.publicado ? ' ✓' : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          className={futbolButtonClass('ghost')}
          disabled={bootstrapping}
          onClick={() => void bootstrapAll()}
        >
          <span className="inline-flex items-center gap-1.5">
            <Layers size={14} />
            {bootstrapping ? '...' : 'Bootstrap 8 cat.'}
          </span>
        </button>
        <button
          type="button"
          className={futbolButtonClass('ghost')}
          onClick={() => {
            const sp = new URLSearchParams();
            sp.set('tab', 'fixture');
            if (torneo?.id) sp.set('torneoId', torneo.id);
            setSearchParams(sp);
          }}
        >
          Ir a Fixture
        </button>
      </div>

      {success && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary">
          {success}
        </p>
      )}

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xl font-bold">{torneo?.nombre}</p>
            <p className="text-sm text-muted-foreground">
              {torneo?.categoria?.nombre} · {torneo?.campeonato?.nombre}
            </p>
            <p
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                torneo?.publicado
                  ? 'bg-primary/15 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {torneo?.publicado ? (
                <>
                  <Globe size={12} />
                  Publicado en web
                </>
              ) : (
                <>
                  <GlobeLock size={12} />
                  Borrador (no visible en web)
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            disabled={toggling || !torneo}
            className={futbolButtonClass(torneo?.publicado ? 'ghost' : 'primary')}
            onClick={() => void togglePublicado()}
          >
            {toggling
              ? 'Guardando...'
              : torneo?.publicado
                ? 'Ocultar de web pública'
                : 'Publicar en web pública'}
          </button>
        </div>
      </div>

      {actionError && <FutbolError message={actionError} />}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-2 text-muted-foreground">
              <c.icon size={16} />
              <span className="text-xs uppercase tracking-wide">{c.label}</span>
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </FutbolPanelShell>
  );
}
