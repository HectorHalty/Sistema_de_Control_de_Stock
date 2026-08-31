import { Trophy, Users, Calendar, Shield } from 'lucide-react';
import {
  FutbolError,
  FutbolPanelShell,
  useFutbolOverview,
} from '../futbol-shared';

export function FutbolInicioPanel() {
  const { data, loading, error } = useFutbolOverview();

  if (loading) return <FutbolPanelShell title="Torneo">Cargando...</FutbolPanelShell>;
  if (error) return <FutbolPanelShell title="Torneo"><FutbolError message={error} /></FutbolPanelShell>;
  if (!data?.torneo) {
    return (
      <FutbolPanelShell title="Torneo">
        <p className="text-sm text-muted-foreground">No hay torneo activo configurado.</p>
      </FutbolPanelShell>
    );
  }

  const { torneo, stats } = data;
  const cards = [
    { label: 'Equipos', value: stats?.equipos ?? 0, icon: Users },
    { label: 'Partidos', value: stats?.partidos ?? 0, icon: Calendar },
    { label: 'Capitanes', value: stats?.capitanes ?? 0, icon: Shield },
    { label: 'Jornadas', value: stats?.jornadas ?? 0, icon: Trophy },
  ];

  return (
    <FutbolPanelShell title="Torneo activo">
      <div className="rounded-xl border border-border bg-card p-5">
        <p className="text-xl font-bold">{torneo.nombre}</p>
        <p className="text-sm text-muted-foreground">
          {torneo.categoria?.nombre} · {torneo.campeonato?.nombre}
          {torneo.publicado ? ' · Publicado' : ' · Borrador'}
        </p>
      </div>
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
