import type { SaturdayGridResponse } from '@/app/api/client';

export function SaturdayGridPreview({ data }: { data: SaturdayGridResponse }) {
  const scheduled = data.partidos.filter((p) => p.canchaId && p.hora);
  if (!scheduled.length) {
    return <p className="text-sm text-muted-foreground">Sin partidos programados para esta fecha.</p>;
  }

  const cols = [...data.canchas].sort((a, b) => a.numero - b.numero);
  const horas = [...new Set(scheduled.map((p) => p.hora!))].sort();
  const cellMap = new Map<string, (typeof scheduled)[0]>();
  for (const p of scheduled) {
    cellMap.set(`${p.canchaId}|${p.hora}`, p);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Hora
            </th>
            {cols.map((c) => (
              <th
                key={c.id}
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                C{c.numero}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {horas.map((hora) => (
            <tr key={hora} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-semibold">{hora}</td>
              {cols.map((c) => {
                const match = cellMap.get(`${c.id}|${hora}`) ?? null;
                return (
                  <td key={c.id} className="px-2 py-2 align-top">
                    {match ? (
                      <div
                        className="rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium"
                        style={{
                          borderColor: `${match.categoriaColor ?? '#6BFF9E'}66`,
                          background: `${match.categoriaColor ?? '#6BFF9E'}18`,
                        }}
                        title={`${match.local} vs ${match.visitante}`}
                      >
                        <span className="block text-[9px] font-bold uppercase opacity-80">
                          {match.categoria}
                        </span>
                        {match.local.slice(0, 8)} vs {match.visitante.slice(0, 8)}
                      </div>
                    ) : (
                      <span className="block text-center text-muted-foreground/30">—</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
        Vista multi-categoría — {data.campeonato} · {data.fecha}
      </p>
    </div>
  );
}
