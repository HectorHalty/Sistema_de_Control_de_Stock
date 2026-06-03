import type { CurrentUser } from '@/features/platform/types';

export type PlatformRole = 'SuperAdmin' | 'Gerente_Operaciones' | 'Encargado_Stock' | 'Encargado_Futbol';

/** Identificador interno de módulo (rutas y permisos). */
export type ModuleId = 'dashboard' | 'stock' | 'ventas' | 'online' | 'futbol';

export interface ModuleDefinition {
  id: ModuleId;
  label: string;
  shortLabel: string;
  route: string;
  ready: boolean;
}

export const platformModules: ModuleDefinition[] = [
  { id: 'ventas', label: 'Ventas Físicas', shortLabel: 'Ventas', route: '/ventas', ready: true },
  { id: 'online', label: 'Ventas Online', shortLabel: 'Online', route: '/online', ready: false },
  { id: 'dashboard', label: 'Inicio', shortLabel: 'Inicio', route: '/', ready: true },
  { id: 'futbol', label: 'Fútbol', shortLabel: 'Fútbol', route: '/futbol', ready: false },
  { id: 'stock', label: 'Inventario', shortLabel: 'Inventario', route: '/stock', ready: true },
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
  Encargado_Stock: 'Encargado de Inventario',
  Encargado_Futbol: 'Encargado de Fútbol',
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
  return roleModules[normalizeRole(role)];
}

export function canAccessModule(role: CurrentUser['role'], moduleId: Exclude<ModuleId, 'dashboard'>): boolean {
  return getAllowedModules(role).includes(moduleId);
}

export function getRoleLabel(role: CurrentUser['role']): string {
  return roleLabels[normalizeRole(role)];
}

export function getInitials(username: string): string {
  const parts = username.split(/[.\s_]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return parts[0]?.toUpperCase() || '?';
}

export function getBottomNavModules(role: CurrentUser['role']): ModuleId[] {
  const allowed = getAllowedModules(role);
  if (allowed.length <= 1) return [];

  const leftSide: ModuleId[] = [];
  const rightSide: ModuleId[] = [];
  allowed.forEach((mod, i) => {
    if (i % 2 === 0) leftSide.push(mod);
    else rightSide.push(mod);
  });
  return [...leftSide, 'dashboard', ...rightSide];
}

export function getSidebarModules(role: CurrentUser['role']): ModuleId[] {
  return ['dashboard', ...getAllowedModules(role)];
}

export function shouldShowBottomNavigation(role: CurrentUser['role']): boolean {
  return getAllowedModules(role).length >= 2;
}
