import type {
  FootballInscription,
  FootballJornada,
  FootballMatch,
} from '@/app/api/client';

export type SeasonTableRow = {
  jornada: FootballJornada;
  libreNombre: string | null;
  partidos: FootballMatch[];
};

export function invertCruce(
  matchId: string,
  homeInscripcionId: string,
  awayInscripcionId: string,
  onCruceChange: (
    matchId: string,
    homeInscripcionId: string,
    awayInscripcionId: string,
  ) => void | Promise<void>,
) {
  return onCruceChange(matchId, awayInscripcionId, homeInscripcionId);
}

export function pickSelectedJornada(
  currentId: string,
  jornadas: FootballJornada[],
): string {
  return jornadas.some((jornada) => jornada.id === currentId)
    ? currentId
    : jornadas[0]?.id ?? '';
}

export function buildSeasonTable(
  jornadas: FootballJornada[],
  matches: FootballMatch[],
  inscripciones: FootballInscription[],
): SeasonTableRow[] {
  return [...jornadas]
    .sort((a, b) => a.numero - b.numero)
    .map((jornada) => ({
      jornada,
      libreNombre:
        inscripciones.find((inscripcion) => inscripcion.id === jornada.equipoLibreId)?.equipo
          ?.name ?? null,
      partidos: matches
        .filter((match) => match.jornadaId === jornada.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

export function isFixtureRegenerable(
  jornadas: FootballJornada[],
  matches: Array<{
    status: string;
    homeGoals?: number | null;
    awayGoals?: number | null;
    esWO?: boolean;
  }>,
): boolean {
  return (
    jornadas.length > 0 &&
    jornadas.every((jornada) => !jornada.publicada) &&
    matches.every(
      (match) =>
        match.status === 'pendiente' &&
        match.homeGoals == null &&
        match.awayGoals == null &&
        !match.esWO,
    )
  );
}
