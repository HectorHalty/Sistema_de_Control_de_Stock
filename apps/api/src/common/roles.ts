/** Roles canónicos y grupos de permisos para RBAC en la API. */

import { RolUsuario } from '@prisma/client';

export const ROLES = {
  SUPER_ADMIN: RolUsuario.SuperAdmin,
  ADMIN: RolUsuario.Admin,
  OPERADOR_STOCK: RolUsuario.Operador_Stock,
  VENDEDOR: RolUsuario.Vendedor,
  GERENTE_VENTAS: RolUsuario.Gerente_Ventas,
  OPERADOR_FUTBOL: RolUsuario.Operador_Futbol,
  OPERADOR_COCINA: RolUsuario.Operador_Cocina,
} as const;

export type Role = RolUsuario;

/** Roles que se pueden asignar al crear o editar usuarios. */
export const ASSIGNABLE_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.OPERADOR_STOCK,
  ROLES.VENDEDOR,
  ROLES.GERENTE_VENTAS,
  ROLES.OPERADOR_FUTBOL,
  ROLES.OPERADOR_COCINA,
] as const;

export function isKnownRole(role: string): role is RolUsuario {
  return Object.values(RolUsuario).includes(role as RolUsuario);
}

export function assertAssignableRole(role: string): RolUsuario {
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number])) {
    throw new Error(`Invalid role: ${role}`);
  }
  return role as RolUsuario;
}

export function hasAnyRole(userRole: string, allowedRoles: readonly string[]): boolean {
  if (!userRole) return false;
  return allowedRoles.includes(userRole);
}

/** Acceso total de administración del sistema. */
export const ADMIN_ROLES = [ROLES.ADMIN, ROLES.SUPER_ADMIN] as const;

/** Gestión de usuarios y roles. */
export const USER_MANAGEMENT_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN] as const;

/** Lectura de inventario. */
export const STOCK_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_STOCK] as const;
export const STOCK_MUTATION_ROLES = [...STOCK_READ_ROLES] as const;
export const STOCK_COUNT_ROLES = [...STOCK_MUTATION_ROLES] as const;
export const STOCK_CONSUMPTION_ROLES = [...STOCK_MUTATION_ROLES] as const;

/** Lectura del módulo de ventas físicas. */
export const SALES_READ_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  ROLES.VENDEDOR,
] as const;
export const SALES_OPERATION_ROLES = [...SALES_READ_ROLES] as const;

/** Configuración del catálogo de ventas. */
export const SALES_CATALOG_ROLES = [...ADMIN_ROLES, ROLES.GERENTE_VENTAS] as const;

/** Anulación y edición de tickets. */
export const SALES_ADMIN_ROLES = [...ADMIN_ROLES, ROLES.GERENTE_VENTAS] as const;

/** Impresión de tickets (mostrador). */
export const PRINTER_ROLES = [
  ...ADMIN_ROLES,
  ROLES.GERENTE_VENTAS,
  ROLES.VENDEDOR,
] as const;

/** Panel de fútbol. */
export const FOOTBALL_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_FUTBOL] as const;
export const FOOTBALL_MUTATION_ROLES = [...FOOTBALL_READ_ROLES] as const;

/** Panel online y cocina. */
export const ONLINE_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_COCINA] as const;
export const ONLINE_MUTATION_ROLES = [...ONLINE_READ_ROLES] as const;
export const KITCHEN_READ_ROLES = [...ONLINE_READ_ROLES] as const;
export const KITCHEN_MUTATION_ROLES = [...ONLINE_MUTATION_ROLES] as const;

export const MIN_PASSWORD_LENGTH = 8;

export function isVendedorRole(role: string): boolean {
  return role === ROLES.VENDEDOR;
}
