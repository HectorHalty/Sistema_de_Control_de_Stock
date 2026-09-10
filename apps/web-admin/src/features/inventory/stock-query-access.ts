import { canAccessModule } from '@/features/platform/config/modules';
import type { UserRole } from '@/features/platform/types';

const KNOWN_ROLES = new Set<string>([
  'SuperAdmin',
  'Admin',
  'Operador_Stock',
  'Vendedor',
  'Gerente_Ventas',
  'Operador_Futbol',
  'Operador_Cocina',
]);

function asUserRole(role: string | null): UserRole | null {
  if (!role || !KNOWN_ROLES.has(role)) return null;
  return role as UserRole;
}

/** Productos + almacenes + categorías: POS y módulo inventario. */
export function canQueryStockCatalog(role: string | null): boolean {
  const typed = asUserRole(role);
  if (!typed) return false;
  return canAccessModule(typed, 'stock') || canAccessModule(typed, 'ventas');
}

/** Movimientos, proveedores, OC, conteos: solo módulo inventario. */
export function canQueryStockAdmin(role: string | null): boolean {
  const typed = asUserRole(role);
  if (!typed) return false;
  return canAccessModule(typed, 'stock');
}
