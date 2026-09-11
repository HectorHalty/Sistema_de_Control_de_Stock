import type {
  FootballInscription,
  FootballJornada,
  FootballMatch,
} from '@/app/api/client';
import { futbolButtonClass, futbolFieldClass } from '../futbol-shared';
import { buildSeasonTable, invertCruce } from './fixture-season-table';

export function FixtureSeasonTable({
  jornadas,
  matches,
  inscripciones,
  onCruceChange,
}: {
  jornadas: FootballJornada[];
  matches: FootballMatch[];
  inscripciones: FootballInscription[];
  onCruceChange: (
    matchId: string,
    homeInscripcionId: string,
    awayInscripcionId: string,
  ) => void | Promise<void>;
}) {
  const rows = buildSeasonTable(jornadas, matches, inscripciones);
  const partidoColumns = Math.max(0, ...rows.map((row) => row.partidos.length));

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Fecha
            </th>
            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Libre
            </th>
            {Array.from({ length: partidoColumns }, (_, index) => (
              <th
                key={index}
                className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Partido {index + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.jornada.id} className="border-b border-border last:border-0">
              <td className="whitespace-nowrap px-3 py-2 font-medium">
                Fecha {row.jornada.numero}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {row.libreNombre ?? '—'}
              </td>
              {Array.from({ length: partidoColumns }, (_, index) => {
                const match = row.partidos[index];
                if (!match) {
                  return (
                    <td key={index} className="px-2 py-2 text-center text-muted-foreground/30">
                      —
                    </td>
                  );
                }

                const homeInscripcionId =
                  match.homeInscripcionId ??
                  inscripciones.find((item) => item.equipoId === match.homeTeamId)?.id ??
                  '';
                const awayInscripcionId =
                  match.awayInscripcionId ??
                  inscripciones.find((item) => item.equipoId === match.awayTeamId)?.id ??
                  '';

                return (
                  <td key={match.id} className="min-w-[390px] px-2 py-2 align-top">
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Local fecha ${row.jornada.numero}, partido ${index + 1}`}
                        className={futbolFieldClass('min-w-[125px]')}
                        value={homeInscripcionId}
                        onChange={(event) =>
                          void onCruceChange(match.id, event.target.value, awayInscripcionId)
                        }
                      >
                        {inscripciones.map((inscripcion) => (
                          <option key={inscripcion.id} value={inscripcion.id}>
                            {inscripcion.equipo?.name}
                          </option>
                        ))}
                      </select>
                      <span className="text-xs text-muted-foreground">vs</span>
                      <select
                        aria-label={`Visitante fecha ${row.jornada.numero}, partido ${index + 1}`}
                        className={futbolFieldClass('min-w-[125px]')}
                        value={awayInscripcionId}
                        onChange={(event) =>
                          void onCruceChange(match.id, homeInscripcionId, event.target.value)
                        }
                      >
                        {inscripciones.map((inscripcion) => (
                          <option key={inscripcion.id} value={inscripcion.id}>
                            {inscripcion.equipo?.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={futbolButtonClass('ghost')}
                        onClick={() =>
                          void invertCruce(
                            match.id,
                            homeInscripcionId,
                            awayInscripcionId,
                            onCruceChange,
                          )
                        }
                      >
                        Invertir
                      </button>
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
