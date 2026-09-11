import { pairKey } from './berger';

export const CRUCE_WARNINGS = {
  dobleEnFecha: 'Un equipo juega dos veces en esta fecha.',
  fechaIncoherente: 'La fecha queda incoherente: hay equipos sin partido y el libre no cierra.',
  cruceRepetido: 'Este cruce ya existe en otra fecha del torneo.',
  resultadoOPublicado:
    'El partido ya tiene resultado, WO o la jornada está publicada. La tabla de posiciones puede quedar desfasada.',
} as const;

export type CruceWarningInput = {
  matchId: string;
  nuevaHomeInscripcionId: string;
  nuevaAwayInscripcionId: string;
  jornadaPublicada: boolean;
  matchTieneResultado: boolean;
  inscripcionIdsTorneo: string[];
  partidosJornada: {
    id: string;
    homeInscripcionId: string | null;
    awayInscripcionId: string | null;
  }[];
  paresOtrasJornadas: { homeTeamId: string; awayTeamId: string }[];
  nuevaHomeTeamId: string;
  nuevaAwayTeamId: string;
};

export function collectCruceWarnings(input: CruceWarningInput): string[] {
  const warnings = new Set<string>();
  const apariciones = new Map<string, number>();

  for (const partido of input.partidosJornada) {
    const inscripciones =
      partido.id === input.matchId
        ? [input.nuevaHomeInscripcionId, input.nuevaAwayInscripcionId]
        : [partido.homeInscripcionId, partido.awayInscripcionId];

    for (const inscripcionId of inscripciones) {
      if (inscripcionId) {
        apariciones.set(inscripcionId, (apariciones.get(inscripcionId) ?? 0) + 1);
      }
    }
  }

  const hayDuplicados = [...apariciones.values()].some((cantidad) => cantidad > 1);
  if (hayDuplicados) {
    warnings.add(CRUCE_WARNINGS.dobleEnFecha);
  }

  const ausentes = input.inscripcionIdsTorneo.filter(
    (inscripcionId) => !apariciones.has(inscripcionId),
  );
  if (hayDuplicados || ausentes.length > 1) {
    warnings.add(CRUCE_WARNINGS.fechaIncoherente);
  }

  const nuevaClave = pairKey(input.nuevaHomeTeamId, input.nuevaAwayTeamId);
  if (
    input.paresOtrasJornadas.some(
      (par) => pairKey(par.homeTeamId, par.awayTeamId) === nuevaClave,
    )
  ) {
    warnings.add(CRUCE_WARNINGS.cruceRepetido);
  }

  if (input.matchTieneResultado || input.jornadaPublicada) {
    warnings.add(CRUCE_WARNINGS.resultadoOPublicado);
  }

  return [...warnings];
}
