import { FutbolPanelShell } from '../futbol-shared';

export function CategoriasPanel() {
  return (
    <FutbolPanelShell title="Categorías">
      <div className="rounded-xl border border-dashed border-border bg-muted p-8 text-center text-sm text-muted-foreground">
        Próximamente: alta y edición de categorías, campeonatos y torneos.
      </div>
    </FutbolPanelShell>
  );
}
