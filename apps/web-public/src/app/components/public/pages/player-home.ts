import type { MeContext, PublicRol, PublicStandingRow } from '../../../api/public-api';

const TEAM_ROLES: PublicRol[] = ['seguidor', 'jugador', 'capitan'];

export function playerHomeSections(
  rol: PublicRol,
  meContext: MeContext | null,
  dniEnPlantelOtroEmail?: string,
) {
  const hasTeam = TEAM_ROLES.includes(rol);
  const standing = meContext?.standingsPosition as PublicStandingRow | null | undefined;

  return {
    showTorneoGenerico: true,
    showMiProximoPartido: hasTeam && !!meContext?.proximoPartido,
    showStatsStrip: rol === 'jugador' && !!meContext?.personalStats,
    showEmailMismatch: !!dniEnPlantelOtroEmail && rol === 'usuario',
    teamLabel: meContext?.equipo
      ? `${meContext.equipo.name} · ${meContext.equipo.categoria ?? 'Torneo'}`
      : null,
    highlightTeamId: hasTeam && standing?.inscripcionId ? standing.inscripcionId : null,
  };
}
