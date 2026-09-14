import type { MeContext, PublicRol } from '../../../api/public-api';

const TEAM_ROLES: PublicRol[] = ['seguidor', 'jugador', 'capitan'];
/** Roles que *juegan* el partido: sólo a ellos se les dice "sos local/visitante". */
const PLAYING_ROLES: PublicRol[] = ['jugador', 'capitan'];

export function playerHomeSections(
  rol: PublicRol,
  meContext: MeContext | null,
  dniEnPlantelOtroEmail?: string,
) {
  const hasTeam = TEAM_ROLES.includes(rol);
  const plays = PLAYING_ROLES.includes(rol);
  const standing = meContext?.standingsPosition ?? null;

  return {
    showTorneoGenerico: true,
    showMiProximoPartido: hasTeam && !!meContext?.proximoPartido,
    // Un seguidor ve el próximo partido de su equipo, pero no es "su" partido:
    // nada de "Mi Próximo Partido" ni de "Sos local" (spec §5a).
    showLocalBadge: plays && !!meContext?.proximoPartido,
    showStatsStrip: rol === 'jugador' && !!meContext?.personalStats,
    showEmailMismatch: !!dniEnPlantelOtroEmail && rol === 'usuario',
    teamLabel: meContext?.equipo
      ? `${meContext.equipo.name} · ${meContext.equipo.categoria ?? 'Torneo'}`
      : null,
    highlightTeamId: hasTeam && standing?.inscripcionId ? standing.inscripcionId : null,
  };
}
