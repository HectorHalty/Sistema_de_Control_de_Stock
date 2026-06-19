/** Roles canónicos y grupos de permisos para RBAC en la API. */

export const ROLES = {
  SUPER_ADMIN: 'SuperAdmin',
  ADMIN: 'Admin',
  OPERADOR_STOCK: 'Operador_Stock',
  VENDEDOR: 'Vendedor',
  GERENTE_VENTAS: 'Gerente_Ventas',
  OPERADOR_FUTBOL: 'Operador_Futbol',
  OPERADOR_COCINA: 'Operador_Cocina',
  /** @deprecated */
  OPERADOR: 'Operador',
  /** @deprecated */
  VIEWER: 'Viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES]
  | 'Gerente_Operaciones'
  | 'Encargado_Stock'
  | 'Encargado_Futbol';

/** Roles que se pueden asignar al crear/editar usuarios. */
export const ASSIGNABLE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.OPERADOR_STOCK,
  ROLES.VENDEDOR,
  ROLES.GERENTE_VENTAS,
  ROLES.OPERADOR_FUTBOL,
  ROLES.OPERADOR_COCINA,
] as const;

const LEGACY_ROLE_ALIASES: Record<string, string> = {
  Gerente_Operaciones: ROLES.GERENTE_VENTAS,
  Encargado_Stock: ROLES.OPERADOR_STOCK,
  Encargado_Futbol: ROLES.OPERADOR_FUTBOL,
  [ROLES.VIEWER]: ROLES.OPERADOR_STOCK,
  [ROLES.OPERADOR]: ROLES.VENDEDOR,
};

export function normalizeApiRole(role: string): string {
  if (
    role === ROLES.SUPER_ADMIN ||
    role === ROLES.ADMIN ||
    role === ROLES.OPERADOR_STOCK ||
    role === ROLES.VENDEDOR ||
    role === ROLES.GERENTE_VENTAS ||
    role === ROLES.OPERADOR_FUTBOL ||
    role === ROLES.OPERADOR_COCINA
  ) {
    return role;
  }
  return LEGACY_ROLE_ALIASES[role] ?? role;
}

export function isKnownRole(role: string): boolean {
  const normalized = normalizeApiRole(role);
  return (
    normalized === ROLES.SUPER_ADMIN ||
    normalized === ROLES.ADMIN ||
    ASSIGNABLE_ROLES.includes(normalized as (typeof ASSIGNABLE_ROLES)[number])
  );
}

export function assertAssignableRole(role: string): string {
  const normalized = normalizeApiRole(role);
  if (!ASSIGNABLE_ROLES.includes(normalized as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new Error(`Invalid role: ${role}`);
  }
  return normalized;
}

export function hasAnyRole(userRole: string, allowedRoles: readonly string[]): boolean {
  if (!userRole) return false;
  const normalized = normalizeApiRole(userRole);
  return allowedRoles.some(role => normalizeApiRole(role) === normalized || role === userRole);
}

/** Acceso total de administración del sistema. */
export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN] as const;

/** Gestión de usuarios y roles (solo Super Admin). */
export const USER_MANAGEMENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN] as const;

/** Lectura de inventario. */
export const STOCK_READ_ROLES = [
  ...ADMIN_ROLES,
  ROLES.OPERADOR_STOCK,
  'Encargado_Stock',
] as const;

/** Mutaciones de inventario. */
export const STOCK_MUTATION_ROLES = [...STOCK_READ_ROLES] as const;

/** Registro de conteos de stock. */
export const STOCK_COUNT_ROLES = [...STOCK_MUTATION_ROLES] as const;

/** Consumo de empleados (registro). */
export const STOCK_CONSUMPTION_ROLES = [...STOCK_MUTATION_ROLES] as const;

/** Lectura del módulo de ventas físicas. */
export const SALES_READ_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  ROLES.VENDEDOR,
  'Gerente_Operaciones',
  ROLES.OPERADOR,
] as const;

/** Operaciones de venta (checkout, devoluciones). */
export const SALES_OPERATION_ROLES = [...SALES_READ_ROLES] as const;

/** Configuración del catálogo de ventas. */
export const SALES_CATALOG_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  'Gerente_Operaciones',
] as const;

/** Anulación y edición de tickets. */
export const SALES_ADMIN_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  'Gerente_Operaciones',
] as const;

/** Impresión de tickets (mostrador). */
export const PRINTER_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  ROLES.VENDEDOR,
  'Gerente_Operaciones',
  ROLES.OPERADOR,
] as const;

/** Lectura del panel de fútbol. */
export const FOOTBALL_READ_ROLES = [
  ...ADMIN_ROLES,
  ROLES.OPERADOR_FUTBOL,
  'Encargado_Futbol',
] as const;

export const FOOTBALL_MUTATION_ROLES = [...FOOTBALL_READ_ROLES] as const;

/** Lectura del panel online / cocina. */
export const ONLINE_READ_ROLES = [
  ...ADMIN_ROLES,
  ROLES.OPERADOR_COCINA,
] as const;

export const ONLINE_MUTATION_ROLES = [...ONLINE_READ_ROLES] as const;

export const KITCHEN_READ_ROLES = [...ONLINE_READ_ROLES] as const;
export const KITCHEN_MUTATION_ROLES = [...ONLINE_MUTATION_ROLES] as const;

export const MIN_PASSWORD_LENGTH = 8;

export function isVendedorRole(role: string): boolean {
  const normalized = normalizeApiRole(role);
  return normalized === ROLES.VENDEDOR;
}
