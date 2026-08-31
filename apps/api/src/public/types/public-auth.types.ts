export type PublicRol = 'usuario' | 'seguidor' | 'jugador' | 'capitan';

export interface PublicJwtPayload {
  sub: string;
  type: 'publico';
  rol: PublicRol;
  email: string;
  equipoInscripcionId?: string;
  torneoId?: string;
  personaId?: string;
  tieneStatsPersonales: boolean;
}

export interface PublicSessionUser {
  id: string;
  email: string;
  rol: PublicRol;
  avatarUrl?: string | null;
  dniConfirmado?: string | null;
  personaId?: string | null;
  equipoInscripcionId?: string | null;
  torneoId?: string | null;
  tieneStatsPersonales: boolean;
  needsDni: boolean;
  puedeSeguirEquipo: boolean;
  puedeSerCapitan: boolean;
}
