/**
 * Barrel de compatibilidad — preferir imports desde @/features/* o @/app/providers/use-app-state.
 */
export { useAppState, type AppState } from '@/app/providers/use-app-state';

export type {
  Category,
  Product,
  Warehouse,
  Order,
  Supplier,
  ConsumptionLog,
  EmployeeConsumptionEntry,
  AuditEntry,
  AuditModule,
} from '@/features/inventory/types';

export {
  getUnitLabel,
  roundUpToOrderUnit,
} from '@/features/inventory/types';

export {
  initialCategories,
  initialWarehouses,
  initialProducts,
  initialSuppliers,
  initialOrders,
  initialAuditLog,
} from '@/features/inventory/seeds';

export type {
  Kitchen,
  SalesProduct,
  SalesTicket,
  SalesTable,
  SalesHistoryEntry,
} from '@/features/sales/types';

export {
  initialKitchens,
  initialSalesProducts,
  initialTables,
} from '@/features/sales/seeds';

export type { KitchenOrder, KitchenOrderStatus } from '@/features/kitchen/types';

export type { OnlineProduct, Sponsor, MediaItem } from '@/features/online/types';

export type { UserRole, CurrentUser, AppUser } from '@/features/platform/types';

export { initialUsers } from '@/features/platform/types';
