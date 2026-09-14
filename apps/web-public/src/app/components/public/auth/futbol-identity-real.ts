/**
 * Branch real de `useFutbolIdentity` (§7 del spec de identidad-login-b).
 * Funciones puras que mapean las formas reales de `publicApi` (`PublicTorneoDetail`)
 * a los tipos que ya consumen Home/Perfil (`TorneoPublico`, definidos junto al
 * adapter mock en `mocks/futbol-identity.ts` para no duplicar la forma).
 */
import type { PublicMatchPreview, PublicTorneoDetail } from '../../../api/public-api';
import type { TorneoPublico, TorneoResultado } from '../../../mocks/futbol-identity';

function equipoRef(nombre: string, detail: PublicTorneoDetail): PublicMatchPreview['local'] {
  const equipo = detail.equipos.find((e) => e.name === nombre);
  return { id: equipo?.id ?? '', name: nombre, shortName: equipo?.shortName ?? undefined };
}

/**
 * Convierte el detalle real de un torneo (`GET /public/torneo`) en la vista
 * `TorneoPublico` que ya consumen `HomePage`/`ProfilePage` a través del adapter.
 * `standings` no se transforma: ya es `PublicStandingRow[]`, la misma forma.
 */
export function buildTorneoPublico(detail: PublicTorneoDetail): TorneoPublico {
  const proximosPartidos: PublicMatchPreview[] = [];
  const resultados: TorneoResultado[] = [];

  for (const p of detail.partidos) {
    if (p.status === 'jugado') {
      resultados.push({
        id: p.id,
        local: p.local,
        visitante: p.visitante,
        golesLocal: p.homeGoals ?? 0,
        golesVisitante: p.awayGoals ?? 0,
        fecha: p.fecha,
      });
    } else {
      proximosPartidos.push({
        id: p.id,
        fecha: p.fecha,
        hora: p.hora,
        cancha: p.cancha,
        jornada: p.jornada,
        local: equipoRef(p.local, detail),
        visitante: equipoRef(p.visitante, detail),
      });
    }
  }

  return {
    torneo: { id: detail.torneo.id, nombre: detail.torneo.nombre, categoria: detail.torneo.categoria },
    standings: detail.standings,
    proximosPartidos,
    resultados,
  };
}

export const EMPTY_TORNEO_PUBLICO: TorneoPublico = {
  torneo: { id: '', nombre: '', categoria: '' },
  standings: [],
  proximosPartidos: [],
  resultados: [],
};
