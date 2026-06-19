import type { CurrentUser, UserRole } from '@/features/platform/types';

/** Identificador interno de módulo (rutas y permisos). */
export type ModuleId = 'dashboard' | 'stock' | 'ventas' | 'online' | 'futbol';

/** Roles canónicos del sistema. */
export type PlatformRole =
  | 'SuperAdmin'
  | 'Operador_Stock'
  | 'Vendedor'
  | 'Gerente_Ventas'
  | 'Operador_Futbol'
  | 'Operador_Cocina';

export type StockRoute =
  | 'inicio'
  | 'productos'
  | 'almacenes'
  | 'pedidos'
  | 'proveedores'
  | 'consumo'
  | 'registrar-consumo'
  | 'reportes';

export type StockReportTab = 'control' | 'movimientos' | 'alertas' | 'historial';

export type VentasTab =
  | 'inicio'
  | 'mostrador'
  | 'pedidos'
  | 'devoluciones'
  | 'productos'
  | 'mesas'
  | 'reportes';

export type VentasReportSection = 'ventas' | 'metricas' | 'historial';

export type SettingsTab = 'general' | 'stock' | 'ventas' | 'futbol' | 'online';

const ALL_MODULES: ModuleId[] = ['stock', 'ventas', 'online', 'futbol'];

const MODULE_ACCESS: Record<PlatformRole, ModuleId[]> = {
  SuperAdmin: ALL_MODULES,
  Operador_Stock: ['stock'],
  Vendedor: ['ventas'],
  Gerente_Ventas: ['ventas'],
  Operador_Futbol: ['futbol'],
  Operador_Cocina: ['online'],
};

const STOCK_ROUTES: Record<PlatformRole, StockRoute[] | 'all'> = {
  SuperAdmin: 'all',
  Operador_Stock: [
    'inicio',
    'productos',
    'almacenes',
    'pedidos',
    'proveedores',
    'consumo',
    'registrar-consumo',
    'reportes',
  ],
  Vendedor: [],
  Gerente_Ventas: [],
  Operador_Futbol: [],
  Operador_Cocina: [],
};

/** Pestañas de reportes de stock bloqueadas por rol (alertas = métricas). */
const STOCK_REPORT_DENIED: Partial<Record<PlatformRole, StockReportTab[]>> = {
  Operador_Stock: ['alertas', 'historial'],
};

const VENTAS_TABS: Record<PlatformRole, VentasTab[] | 'all'> = {
  SuperAdmin: 'all',
  Operador_Stock: [],
  Vendedor: ['mostrador', 'pedidos', 'devoluciones'],
  Gerente_Ventas: 'all',
  Operador_Futbol: [],
  Operador_Cocina: [],
};

const VENTAS_REPORT_DENIED: Partial<Record<PlatformRole, VentasReportSection[]>> = {
  Vendedor: ['metricas', 'historial', 'ventas'],
};

export const ROLE_LABELS: Record<PlatformRole, string> = {
  SuperAdmin: 'Super Admin',
  Operador_Stock: 'Operador de Stock',
  Vendedor: 'Vendedor',
  Gerente_Ventas: 'Gerente de Ventas',
  Operador_Futbol: 'Operador de Fútbol',
  Operador_Cocina: 'Operador de Cocina',
};

export const ASSIGNABLE_ROLES: PlatformRole[] = [
  'SuperAdmin',
  'Operador_Stock',
  'Vendedor',
  'Gerente_Ventas',
  'Operador_Futbol',
  'Operador_Cocina',
];

export function normalizeRole(role: UserRole | string): PlatformRole {
  switch (role) {
    case 'SuperAdmin':
    case 'Operador_Stock':
    case 'Vendedor':
    case 'Gerente_Ventas':
    case 'Operador_Futbol':
    case 'Operador_Cocina':
      return role;
    case 'Admin':
      return 'SuperAdmin';
    case 'Gerente_Operaciones':
      return 'Gerente_Ventas';
    case 'Encargado_Stock':
    case 'Viewer':
      return 'Operador_Stock';
    case 'Encargado_Futbol':
      return 'Operador_Futbol';
    case 'Operador':
      return 'Vendedor';
    default:
      return 'Operador_Stock';
  }
}

export function getAllowedModules(role: CurrentUser['role']): ModuleId[] {
  return MODULE_ACCESS[normalizeRole(role)];
}

export function canAccessModule(role: CurrentUser['role'], moduleId: Exclude<ModuleId, 'dashboard'>): boolean {
  return getAllowedModules(role).includes(moduleId);
}

export function canManageUsers(role: CurrentUser['role']): boolean {
  return normalizeRole(role) === 'SuperAdmin';
}

export function canAccessStockRoute(role: CurrentUser['role'], route: StockRoute): boolean {
  if (!canAccessModule(role, 'stock')) return false;
  const allowed = STOCK_ROUTES[normalizeRole(role)];
  return allowed === 'all' || allowed.includes(route);
}

export function canAccessStockReportTab(role: CurrentUser['role'], tab: StockReportTab): boolean {
  if (!canAccessStockRoute(role, 'reportes')) return false;
  const denied = STOCK_REPORT_DENIED[normalizeRole(role)] ?? [];
  return !denied.includes(tab);
}

export function stockRouteFromPath(pathname: string): StockRoute | null {
  if (pathname === '/stock' || pathname.startsWith('/stock')) return 'inicio';
  if (pathname.startsWith('/productos')) return 'productos';
  if (pathname.startsWith('/almacenes')) return 'almacenes';
  if (pathname.startsWith('/pedidos')) return 'pedidos';
  if (pathname.startsWith('/proveedores')) return 'proveedores';
  if (pathname.startsWith('/consumo')) return 'consumo';
  if (pathname.startsWith('/registrar-consumo')) return 'registrar-consumo';
  if (pathname.startsWith('/reportes')) return 'reportes';
  return null;
}

export function canAccessVentasTab(role: CurrentUser['role'], tab: VentasTab): boolean {
  if (!canAccessModule(role, 'ventas')) return false;
  const allowed = VENTAS_TABS[normalizeRole(role)];
  return allowed === 'all' || allowed.includes(tab);
}

export function canAccessVentasReportSection(role: CurrentUser['role'], section: VentasReportSection): boolean {
  if (!canAccessVentasTab(role, 'reportes')) return false;
  const denied = VENTAS_REPORT_DENIED[normalizeRole(role)] ?? [];
  return !denied.includes(section);
}

export function getDefaultVentasTab(role: CurrentUser['role']): VentasTab {
  const allowed = VENTAS_TABS[normalizeRole(role)];
  if (allowed === 'all') return 'mostrador';
  return allowed[0] ?? 'mostrador';
}

export function getDefaultStockReportTab(role: CurrentUser['role']): StockReportTab {
  const tabs: StockReportTab[] = ['control', 'movimientos', 'alertas', 'historial'];
  return tabs.find(tab => canAccessStockReportTab(role, tab)) ?? 'control';
}

export function getDefaultVentasReportSection(role: CurrentUser['role']): VentasReportSection {
  const sections: VentasReportSection[] = ['ventas', 'metricas', 'historial'];
  return sections.find(section => canAccessVentasReportSection(role, section)) ?? 'ventas';
}

export function canAccessSettings(role: CurrentUser['role']): boolean {
  const normalized = normalizeRole(role);
  if (normalized === 'SuperAdmin') return true;
  if (canManageUsers(role)) return true;
  if (normalized === 'Vendedor') return true;
  return getSettingsTabs(role).length > 0;
}

export function canConfigurePrinters(role: CurrentUser['role']): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'SuperAdmin' || normalized === 'Vendedor' || normalized === 'Gerente_Ventas';
}

export function getSettingsTabs(role: CurrentUser['role']): SettingsTab[] {
  const normalized = normalizeRole(role);

  if (normalized === 'SuperAdmin') {
    return ['general', 'stock', 'ventas', 'futbol', 'online'];
  }

  const tabs: SettingsTab[] = [];

  if (canAccessModule(role, 'stock')) tabs.push('stock');
  if (canAccessModule(role, 'ventas') && normalized !== 'Vendedor') tabs.push('ventas');
  if (canConfigurePrinters(role) && normalized === 'Vendedor') tabs.push('ventas');
  if (canAccessModule(role, 'futbol')) tabs.push('futbol');
  if (canAccessModule(role, 'online')) tabs.push('online');

  return tabs;
}

export function ventasSettingsPrintersOnly(role: CurrentUser['role']): boolean {
  return normalizeRole(role) === 'Vendedor';
}

export function getRoleLabel(role: CurrentUser['role']): string {
  return ROLE_LABELS[normalizeRole(role)];
}

export function canSeeStockMetrics(role: CurrentUser['role']): boolean {
  return canAccessStockReportTab(role, 'alertas');
}

export function canSeeStockHistory(role: CurrentUser['role']): boolean {
  return canAccessStockReportTab(role, 'historial');
}
