import { FutbolPanelShell } from '../futbol-shared';

export function HorariosCanchasPanel() {
  return (
    <FutbolPanelShell title="Horarios y Canchas">
      <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
        Próximamente: grillas de hombres/mujeres con asignación de partidos y
        suspensión de partido/jornada/sábado.
      </div>
    </FutbolPanelShell>
  );
}
