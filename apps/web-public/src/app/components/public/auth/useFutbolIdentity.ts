import { usePublicAuth } from './PublicAuthContext';
import type { CaptainTeamData, MeContext, PublicTeamOption } from '../../../api/public-api';
import {
  USE_MOCK_FUTBOL, resolveMockRole, resolveMockContext, resolveMockCaptainTeam,
  listMockTeams, mockFollowTeam, mockUnfollowTeam, mockTorneoPublico,
  type MockRoleResult, type TorneoPublico,
} from '../../../mocks/futbol-identity';

/**
 * Contrato único del adapter de identidad de torneo. El branch mock y el branch
 * real (§7) deben satisfacer exactamente esta interfaz: al invertir
 * `USE_MOCK_FUTBOL` el compilador marca cualquier desvío de firma.
 */
export interface FutbolIdentity {
  role: MockRoleResult;
  meContext: MeContext | null;
  getCaptainTeam: () => CaptainTeamData | null;
  listTeams: (search?: string) => PublicTeamOption[];
  followTeam: (equipoInscripcionId: string) => void;
  unfollowTeam: () => void;
  torneoPublico: () => TorneoPublico;
}

export function useFutbolIdentity(): FutbolIdentity {
  const { user, bumpFollowVersion } = usePublicAuth();

  if (USE_MOCK_FUTBOL) {
    const role: MockRoleResult = user ? resolveMockRole(user) : { rol: 'usuario' };
    return {
      role,
      meContext: user ? resolveMockContext(user) : null,
      getCaptainTeam: () => (user ? resolveMockCaptainTeam(user) : null),
      listTeams: (search?: string) => listMockTeams(search),
      // El adapter escribe el equipo seguido en localStorage; el bump avisa al
      // contexto para que re-derive el rol efectivo sin recargar la página.
      followTeam: (equipoInscripcionId: string) => {
        if (!user) return;
        mockFollowTeam(user, equipoInscripcionId);
        bumpFollowVersion();
      },
      unfollowTeam: () => {
        if (!user) return;
        mockUnfollowTeam(user);
        bumpFollowVersion();
      },
      torneoPublico: () => mockTorneoPublico(),
    };
  }

  // Branch real: todavía NO está escrito. Es un throw ruidoso a propósito, para
  // que invertir `USE_MOCK_FUTBOL` sin hacer el swap falle de inmediato y no en
  // silencio. Se implementa como parte de la reestructuración (§7 del spec).
  throw new Error('useFutbolIdentity: branch real no implementado — ver §7 del spec');
}

export type { CaptainTeamData, MeContext, PublicTeamOption, TorneoPublico };
