import { FutbolPanelShell } from '../futbol-shared';

export function PlanillasPanel() {
  return (
    <FutbolPanelShell title="Planillas de cancha">
      <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
        Próximamente: vista previa e impresión de planillas de cancha por
        equipo, individual o en lote para el próximo sábado.
      </div>
    </FutbolPanelShell>
  );
}
