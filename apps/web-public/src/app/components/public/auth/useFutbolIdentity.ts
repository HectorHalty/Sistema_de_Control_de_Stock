import { useEffect, useState } from 'react';
import { usePublicAuth } from './PublicAuthContext';
import { publicApi } from '../../../api/public-api';
import type { CaptainTeamData, MeContext, PublicTeamOption } from '../../../api/public-api';
import {
  USE_MOCK_FUTBOL, resolveMockRole, resolveMockContext, resolveMockCaptainTeam,
  listMockTeams, mockFollowTeam, mockUnfollowTeam, mockTorneoPublico,
  type MockRoleResult, type TorneoPublico,
} from '../../../mocks/futbol-identity';
import { buildTorneoPublico, EMPTY_TORNEO_PUBLICO } from './futbol-identity-real';

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
  const { user, token, meContext, dniEnPlantelOtroEmail, applyAuthResponse, bumpFollowVersion } = usePublicAuth();

  // Los tres hooks de estado del branch real se declaran siempre (no sólo
  // cuando `USE_MOCK_FUTBOL` es `false`) para que esta función llame siempre
  // los mismos hooks en el mismo orden — `USE_MOCK_FUTBOL` es una constante de
  // módulo que no cambia en la vida de la app, así que esto no viola las
  // reglas de hooks, pero mantenerlos incondicionales es más simple que
  // justificar la excepción caso por caso.
  const [captainTeam, setCaptainTeam] = useState<CaptainTeamData | null>(null);
  const [teams, setTeams] = useState<PublicTeamOption[]>([]);
  const [torneo, setTorneo] = useState<TorneoPublico>(EMPTY_TORNEO_PUBLICO);

  useEffect(() => {
    if (USE_MOCK_FUTBOL) return;
    if (user?.rol !== 'capitan' || !token) {
      setCaptainTeam(null);
      return;
    }
    let cancelled = false;
    publicApi.captain.getTeam(token).then((data) => {
      if (!cancelled) setCaptainTeam(data);
    }).catch(() => {
      if (!cancelled) setCaptainTeam(null);
    });
    return () => { cancelled = true; };
  }, [user?.rol, token]);

  useEffect(() => {
    if (USE_MOCK_FUTBOL) return;
    let cancelled = false;
    publicApi.teams().then((list) => {
      if (!cancelled) setTeams(list);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const categoria = meContext?.equipo?.categoria;
  useEffect(() => {
    if (USE_MOCK_FUTBOL) return;
    let cancelled = false;
    publicApi.torneo(undefined, categoria).then((detail) => {
      if (!cancelled) setTorneo(detail ? buildTorneoPublico(detail) : EMPTY_TORNEO_PUBLICO);
    }).catch(() => {
      if (!cancelled) setTorneo(EMPTY_TORNEO_PUBLICO);
    });
    return () => { cancelled = true; };
  }, [categoria]);

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

  // Branch real (§7): rol y contexto ya vienen resueltos del backend
  // (`resolveAndUpdateRole`, `/public/me/context`) — no hay nada que
  // re-derivar del lado del cliente, a diferencia del mock.
  return {
    role: { rol: user?.rol ?? 'usuario', dniEnPlantelOtroEmail },
    meContext,
    getCaptainTeam: () => captainTeam,
    listTeams: (search?: string) => {
      const q = (search ?? '').trim().toLowerCase();
      return q ? teams.filter((t) => t.name.toLowerCase().includes(q)) : teams;
    },
    followTeam: (equipoInscripcionId: string) => {
      if (!token) return;
      void publicApi.me.followTeam(equipoInscripcionId, token).then(applyAuthResponse);
    },
    unfollowTeam: () => {
      if (!token) return;
      void publicApi.me.unfollowTeam(token).then(applyAuthResponse);
    },
    torneoPublico: () => torneo,
  };
}

export type { CaptainTeamData, MeContext, PublicTeamOption, TorneoPublico };
