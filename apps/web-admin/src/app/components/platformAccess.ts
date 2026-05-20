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
  { id: 'ventas', label: 'Ventas Fisicas', shortLabel: 'Ventas', route: '/ventas', ready: true },
  { id: 'online', label: 'Ventas Online', shortLabel: 'Online', route: '/online', ready: false },
  { id: 'dashboard', label: 'Inicio', shortLabel: 'Inicio', route: '/', ready: true },
  { id: 'futbol', label: 'Futbol', shortLabel: 'Futbol', route: '/futbol', ready: false },
  { id: 'stock', label: 'Stock', shortLabel: 'Stock', route: '/stock', ready: true },
];

/**
 * Role-permission mapping.
 * Each role lists the modules it can access (excluding dashboard, which is always accessible).
 *
 * - SuperAdmin: full access to all modules
 * - Gerente_Operaciones: stock + ventas (operational oversight)
 * - Encargado_Stock: stock only (warehouse/inventory management)
 * - Encargado_Futbol: futbol only (tournament management)
 */
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

/**
 * Map legacy role names to normalized PlatformRole.
 * Legacy roles: Admin, Operador, Viewer
 * Platform roles: SuperAdmin, Gerente_Operaciones, Encargado_Stock, Encargado_Futbol
 */
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

/**
 * Generate initials from a username for display as operator badge.
 * e.g., "juan.perez" => "JP", "admin" => "AD"
 */
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

/**
 * Returns the ordered list of module IDs for the bottom navigation bar.
 * Only includes modules the user has access to, with dashboard always in the center.
 * If the user has only one module, returns [] (hide bottom nav entirely).
 */
export function getBottomNavModules(role: CurrentUser['role']): ModuleId[] {
  const allowed = getAllowedModules(role);
  if (allowed.length === 0) return [];
  if (allowed.length === 1) return []; // single module: no bottom nav needed

  // Order: left modules, dashboard, right modules
  // We distribute allowed modules around dashboard
  const leftSide: ModuleId[] = [];
  const rightSide: ModuleId[] = [];

  // Distribute alternating: first goes left, second goes right, etc.
  allowed.forEach((mod, i) => {
    if (i % 2 === 0) leftSide.push(mod);
    else rightSide.push(mod);
  });

  return [...leftSide, 'dashboard', ...rightSide];
}

/**
 * Returns the ordered list of module IDs for the sidebar.
 * Includes dashboard + allowed modules.
 */
export function getSidebarModules(role: CurrentUser['role']): ModuleId[] {
  const allowed = getAllowedModules(role);
  return ['dashboard', ...allowed];
}

/**
 * Whether to show the bottom navigation bar.
 * Hidden when user has 0 or 1 accessible modules.
 */
export function shouldShowBottomNavigation(role: CurrentUser['role']): boolean {
  return getAllowedModules(role).length >= 2;
}
