import type { CurrentUser } from '@/features/platform/types';
import {
  getAllowedModules,
  type ModuleId,
} from '@/features/platform/config/permissions';

export type { ModuleId, PlatformRole, StockRoute, StockReportTab, VentasTab, VentasReportSection, SettingsTab } from '@/features/platform/config/permissions';
export {
  ASSIGNABLE_ROLES,
  ROLE_LABELS,
  normalizeRole,
  canAccessModule,
  canManageUsers,
  canAccessStockRoute,
  canAccessStockReportTab,
  stockRouteFromPath,
  canAccessVentasTab,
  canAccessVentasReportSection,
  getDefaultVentasTab,
  getDefaultStockReportTab,
  getDefaultVentasReportSection,
  canAccessSettings,
  canConfigurePrinters,
  getSettingsTabs,
  ventasSettingsPrintersOnly,
  getRoleLabel,
  canSeeStockMetrics,
  canSeeStockHistory,
} from '@/features/platform/config/permissions';

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

export { getAllowedModules };

export function isModuleReady(moduleId: ModuleId): boolean {
  const mod = platformModules.find(m => m.id === moduleId);
  return mod?.ready ?? false;
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
