export type UserRole =
  | 'Admin'
  | 'Operador'
  | 'Viewer'
  | 'SuperAdmin'
  | 'Operador_Stock'
  | 'Vendedor'
  | 'Gerente_Ventas'
  | 'Operador_Futbol'
  | 'Operador_Cocina'
  /** @deprecated Usar Gerente_Ventas */
  | 'Gerente_Operaciones'
  /** @deprecated Usar Operador_Stock */
  | 'Encargado_Stock'
  /** @deprecated Usar Operador_Futbol */
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
