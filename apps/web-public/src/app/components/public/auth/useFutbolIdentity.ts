import { usePublicAuth } from './PublicAuthContext';
import type { CaptainTeamData, MeContext, PublicTeamOption } from '../../../api/public-api';
import {
  USE_MOCK_FUTBOL, resolveMockRole, resolveMockContext, resolveMockCaptainTeam,
  listMockTeams, mockFollowTeam, mockUnfollowTeam, mockTorneoPublico, type MockRoleResult,
} from '../../../mocks/futbol-identity';

export function useFutbolIdentity() {
  const { user } = usePublicAuth();

  if (USE_MOCK_FUTBOL) {
    const role: MockRoleResult = user ? resolveMockRole(user) : { rol: 'usuario' };
    return {
      role,
      meContext: user ? resolveMockContext(user) : null,
      getCaptainTeam: () => (user ? resolveMockCaptainTeam(user) : null),
      listTeams: (search?: string) => listMockTeams(search),
      followTeam: (id: string) => (user ? mockFollowTeam(user, id) : null),
      unfollowTeam: () => (user ? mockUnfollowTeam(user) : null),
      torneoPublico: () => mockTorneoPublico(),
    };
  }

  // Branch real (desactivado hasta el swap de §7 del spec). Deja el código
  // compilando contra los tipos; NO se ejerce mientras USE_MOCK_FUTBOL sea true.
  throw new Error('useFutbolIdentity: branch real no implementado — ver §7 del spec');
}

export type { CaptainTeamData, MeContext, PublicTeamOption };
