export type UserRole =
  | 'Admin'
  | 'Operador'
  | 'Viewer'
  | 'SuperAdmin'
  | 'Gerente_Operaciones'
  | 'Encargado_Stock'
  | 'Encargado_Futbol';

export interface CurrentUser {
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
  { id: 'u2', name: 'Juan Pérez', role: 'Operador' },
  { id: 'u3', name: 'María García', role: 'Operador' },
  { id: 'u4', name: 'Carlos López', role: 'Viewer' },
];
