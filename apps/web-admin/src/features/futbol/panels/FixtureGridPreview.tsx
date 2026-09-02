import type { FootballCancha, FootballMatch } from '@/app/api/client';

function shortLabel(m: FootballMatch) {
  const home = m.homeTeam?.shortName ?? m.homeTeam?.name?.slice(0, 3) ?? '?';
  const away = m.awayTeam?.shortName ?? m.awayTeam?.name?.slice(0, 3) ?? '?';
  return `${home} vs ${away}`;
}

export function FixtureGridPreview({
  matches,
  canchas,
}: {
  matches: FootballMatch[];
  canchas: FootballCancha[];
}) {
  const scheduled = matches.filter((m) => m.canchaId && m.horaInicio);
  if (!scheduled.length) return null;

  const canchaCols = canchas.length
    ? [...canchas].sort((a, b) => a.numero - b.numero)
    : [];

  const usedCanchaIds = new Set(scheduled.map((m) => m.canchaId!));
  const cols =
    canchaCols.length > 0
      ? canchaCols.filter((c) => usedCanchaIds.has(c.id))
      : [...usedCanchaIds].map((id) => {
          const m = scheduled.find((x) => x.canchaId === id);
          return m?.cancha ?? { id, numero: 0, nombre: '?' };
        });

  const horas = [...new Set(scheduled.map((m) => m.horaInicio!))].sort();

  const cellMap = new Map<string, FootballMatch>();
  for (const m of scheduled) {
    cellMap.set(`${m.canchaId}|${m.horaInicio}`, m);
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[480px] border-collapse text-sm">
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
                {c.grupoCanchas?.codigo ? (
                  <span className="block text-[10px] font-normal normal-case">{c.grupoCanchas.codigo}</span>
                ) : null}
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
                        className={`rounded-lg px-2 py-1.5 text-center text-xs font-medium ${
                          match.bloqueadoManual
                            ? 'border border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200'
                            : 'border border-primary/30 bg-primary/10 text-foreground'
                        }`}
                        title={`${match.homeTeam?.name} vs ${match.awayTeam?.name}`}
                      >
                        {shortLabel(match)}
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
        Amarillo = horario fijado manualmente · Verde = asignación automática
      </p>
    </div>
  );
}
