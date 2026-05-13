import type { CurrentUser } from './store';

export type PlatformRole = 'SuperAdmin' | 'Gerente_Operaciones' | 'Encargado_Stock' | 'Encargado_Futbol';

export type ModuleId = 'dashboard' | 'stock' | 'ventas' | 'online' | 'futbol';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  shortLabel: string;
  route: string;
  ready: boolean;
}

export const platformModules: ModuleDefinition[] = [
  { id: 'ventas', label: 'Ventas Fisicas', shortLabel: 'Ventas', route: '/ventas', ready: false },
  { id: 'online', label: 'Ventas Online', shortLabel: 'Online', route: '/online', ready: false },
  { id: 'dashboard', label: 'Inicio', shortLabel: 'Inicio', route: '/', ready: true },
  { id: 'futbol', label: 'Futbol', shortLabel: 'Futbol', route: '/futbol', ready: false },
  { id: 'stock', label: 'Stock', shortLabel: 'Stock', route: '/stock', ready: true },
];

const roleModules: Record<PlatformRole, ModuleId[]> = {
  SuperAdmin: ['stock', 'ventas', 'online', 'futbol'],
  Gerente_Operaciones: ['stock', 'ventas'],
  Encargado_Stock: ['stock'],
  Encargado_Futbol: ['futbol'],
};

const roleLabels: Record<PlatformRole, string> = {
  SuperAdmin: 'Super Admin LCH',
  Gerente_Operaciones: 'Gerente de Operaciones',
  Encargado_Stock: 'Encargado de Stock',
  Encargado_Futbol: 'Encargado de Futbol',
};

export function normalizeRole(role: CurrentUser['role']): PlatformRole {
  if (role === 'SuperAdmin' || role === 'Gerente_Operaciones' || role === 'Encargado_Stock' || role === 'Encargado_Futbol') {
    return role;
  }

  if (role === 'Admin') return 'SuperAdmin';
  if (role === 'Operador') return 'Gerente_Operaciones';
  if (role === 'Viewer') return 'Encargado_Stock';
  return 'Encargado_Stock';
}

export function getAllowedModules(role: CurrentUser['role']): ModuleId[] {
  const normalizedRole = normalizeRole(role);
  return roleModules[normalizedRole];
}

export function canAccessModule(role: CurrentUser['role'], moduleId: Exclude<ModuleId, 'dashboard'>): boolean {
  return getAllowedModules(role).includes(moduleId);
}

export function getRoleLabel(role: CurrentUser['role']): string {
  return roleLabels[normalizeRole(role)];
}

export function shouldShowBottomNavigation(role: CurrentUser['role']): boolean {
  return getAllowedModules(role).length >= 2;
}
