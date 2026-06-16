export type UserRole =
  | 'Admin'
  | 'Operador'
  | 'Viewer'
  | 'SuperAdmin'
  | 'Gerente_Operaciones'
  | 'Encargado_Stock'
  | 'Encargado_Futbol';

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
