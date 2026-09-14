/**
 * Roles canónicos, en espejo exacto del enum RolUsuario del backend
 * (apps/api/prisma/schema.prisma). Agregar o quitar un valor acá y en
 * PlatformRole (config/permissions.ts) es la única forma de que
 * TypeScript reclame cada lugar que necesita actualizarse: normalizeRole
 * usa un switch exhaustivo, no un fallback silencioso.
 */
export type UserRole =
  | 'SuperAdmin'
  | 'Admin'
  | 'Operador_Stock'
  | 'Vendedor'
  | 'Gerente_Ventas'
  | 'Operador_Futbol'
  | 'Operador_Cocina';

export interface CurrentUser {
  /** Backend user id (UUID). Opcional para compatibilidad con sesiones locales previas. */
  id?: string;
  username: string;
  role: UserRole;
}

export interface AppUser {
  id: string;
  name: string;
  role: UserRole;
}

export const initialUsers: AppUser[] = [
  { id: 'u1', name: 'Admin', role: 'Admin' },
];
