# POS stock read, config versionada y paginación — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un Vendedor (y Gerente_Ventas) pueda vender y registrar consumo con stock real; que la configuración remota respete bloqueo optimista; y que el historial de tickets deje de estar topeado en 100 filas.

**Architecture:** Se parte `STOCK_READ_ROLES` en un grupo de catálogo para el POS (`STOCK_POS_READ_ROLES`) y el grupo admin de inventario, sin dar mutaciones de stock a ventas. `persistRemoteConfig` pasa a mandar `version` leída del `GET /settings/config`. El historial de ventas consume `CursorPage` (el POS sigue pidiendo el array corto de siempre). Los hooks chicos que quedaron en `useLocalStorage` + hydrate silencioso (cocina, settings de fútbol/online/plataforma, overviews) pasan a `useQuery`.

**Tech Stack:** NestJS 11 + Prisma 5.22 + PostgreSQL 16 (tests `test/db/**`); React 18 + Vite + TanStack Query 5 + Vitest 3 en `apps/web-admin`.

**Origen:** hallazgo del plan de consumo (`docs/superpowers/plans/2026-09-08-consumo-como-venta.md`) y sobras explícitas de integridad B/C (`docs/superpowers/plans/2026-09-07-integridad-operacional-b.md` Tasks 8/10, `docs/superpowers/plans/2026-09-07-admin-fuente-de-verdad-c.md` fuera de alcance).

## Global Constraints

- Todo el texto visible al usuario va en **español**.
- **No** agregar Vendedor ni Gerente_Ventas a `STOCK_MUTATION_ROLES`. Siguen sin crear productos, ajustar stock, proveedores ni órdenes de compra.
- `STOCK_MUTATION_ROLES` **no** se deriva de `STOCK_POS_READ_ROLES`. Hoy `STOCK_MUTATION_ROLES = [...STOCK_READ_ROLES]`; ese acoplamiento es lo que haría inseguro meter Vendedor en el grupo de lectura admin.
- Productos de stock y de venta **siguen como catálogo completo** en el estado global del POS. No se pagina el picker.
- Tickets del POS (`hydrateTickets` sin `cursor`/`limit`) **siguen devolviendo un array** (hoy, últimos 100). El `CursorPage` es solo para Historial.
- No se pagina movimientos de stock: el backend (`findAllMovements`) **no tiene cursor**, y Reportes/conciliación asumen el array en memoria. Fuera de alcance.
- No se reescribe cada panel de fútbol/online a `useQuery`. Solo los hooks de estado/settings/overview que Plan C dejó afuera.
- No se toca el modelo de torneo, ni `USE_MOCK_FUTBOL`, ni pagos.
- No se amplía `SETTINGS_ROLES` (quién puede `PUT /settings/config`). Eso es otro bug, no este plan.
- Tests API: `npm --prefix apps/api test` (node) y `npm --prefix apps/api run test:db` (Postgres). Front: `npm --prefix apps/web-admin test`. Build: `npm --prefix apps/web-admin run build` y `npm --prefix apps/api run build`.
- Commits en español, un commit por task, terminando con:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

## Cortes YAGNI (no discutirlos de nuevo en las tasks)

| Pedido original | Qué entra | Qué no |
|---|---|---|
| 403 de Vendedor en `GET /stock/products` | Lectura de catálogo de insumos + almacenes + categorías para roles de venta | Acceso al módulo Inventario en el sidebar; mutaciones de stock |
| Versionar `Configuracion` en el front | `persistRemoteConfig` manda `version`; 409 visible | Versionar darkMode (es preferencia de dispositivo, local) |
| Paginación real en listados | Historial de tickets con "Cargar más" | Paginación de productos, proveedores, OC, movimientos; dashboard de ventas sigue en los últimos 100 tickets |
| React Query en fútbol/online/cocina | `use-kitchen-state`, `use-futbol-settings`, `use-online-settings`, settings de stock en `use-platform-state`, `useFutbolOverview`, `useOnlineOverview` | Reescribir EquiposPanel/FixturePanel/MenuWebPanel/etc. |

Las tres fases (Tasks 1–2, 3–5, 6) son independientes: si una se rechaza, las otras siguen valiendo.

---

## File Structure

### Nuevos archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/web-admin/src/features/inventory/stock-query-access.ts` | Funciones puras: qué queries de inventario puede disparar un rol. |
| `apps/web-admin/src/features/inventory/stock-query-access.test.ts` | Tests de esa matriz. |
| `apps/web-admin/src/shared/utils/config-versions.ts` | Mapa `key → version` + armar el payload de upsert. |
| `apps/web-admin/src/shared/utils/config-versions.test.ts` | Tests del mapa y del 409. |
| `apps/web-admin/src/shared/auth/session.test.ts` | Tests de `getSessionUserRole`. |
| `apps/web-admin/src/app/api/cursor-page.ts` | Type `CursorPage<T>` + `isCursorPage`. |
| `apps/web-admin/src/app/api/cursor-page.test.ts` | Tests del type guard. |
| `apps/api/test/db/tickets-cursor.test.ts` | Postgres: `limit` sin `cursor` devuelve `{ items, nextCursor }`; sin ambos, array. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/api/src/common/roles.ts` | Nuevo `STOCK_POS_READ_ROLES`. `STOCK_MUTATION_ROLES` queda anclado a `STOCK_READ_ROLES` (admin + operador stock). |
| `apps/api/src/stock/stock.controller.ts` | GET de products / product by id / stock levels / warehouses / categories usan `STOCK_POS_READ_ROLES`. El resto de GET admin sigue en `STOCK_READ_ROLES`. |
| `apps/api/test/integration/platform-migration-deep.test.ts` | Matriz RBAC: Vendedor lee POS, no muta. |
| `apps/web-admin/src/shared/auth/session.ts` | `getSessionUserRole()`. |
| `apps/web-admin/src/features/inventory/use-inventory-state.ts` | `enabled` por rol en cada `useQuery`. |
| `apps/web-admin/src/shared/utils/remote-config.ts` | Mandar `version`; 409 → `notifyError`. |
| `apps/web-admin/src/features/futbol/use-futbol-settings.ts` | `useQuery` de `settingsApi.config.list('futbol')`. |
| `apps/web-admin/src/features/online/use-online-settings.ts` | Igual, scope `online`. |
| `apps/web-admin/src/features/platform/use-platform-state.ts` | Settings de stock vía `useQuery`; darkMode sigue local. |
| `apps/web-admin/src/features/sales/use-sales-state.ts` | Hidratar config `sales` vía `useQuery`. |
| `apps/web-admin/src/features/kitchen/use-kitchen-state.ts` | `useQuery` de órdenes; sin localStorage. |
| `apps/web-admin/src/features/futbol/futbol-shared.tsx` | `useFutbolOverview` con `useQuery`. |
| `apps/web-admin/src/features/online/online-shared.tsx` | `useOnlineOverview` con `useQuery`. |
| `apps/web-admin/src/shared/storage/keys.ts` | Marcar `kitchen.orders` y keys de settings hidratadas como legacy. |
| `apps/api/src/sales/sales.service.ts` | `findAllTickets`: mismo contrato que productos (limit definido → `CursorPage`). |
| `apps/web-admin/src/app/api/client.ts` | `salesApi.tickets.listPage`. |
| `apps/web-admin/src/features/sales/pos/HistoryModule.tsx` | Historial con `useInfiniteQuery` + "Cargar más". |
| `docs/RUNBOOK.md` | Nota corta: Vendedor lee catálogo de stock; historial pagina. |

---

## Interfaces compartidas (contrato entre tareas)

```ts
// apps/api/src/common/roles.ts
export const STOCK_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_STOCK] as const;
export const STOCK_POS_READ_ROLES = [
  ...STOCK_READ_ROLES,
  ROLES.VENDEDOR,
  ROLES.GERENTE_VENTAS,
] as const;
export const STOCK_MUTATION_ROLES = [...STOCK_READ_ROLES] as const;

// apps/web-admin/src/app/api/cursor-page.ts
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
export function isCursorPage<T>(value: unknown): value is CursorPage<T>;

// apps/web-admin/src/shared/utils/config-versions.ts
export type RemoteConfigRow = {
  key: string;
  scope: string;
  value: unknown;
  version?: number;
};
export function rememberConfigRows(rows: RemoteConfigRow[]): void;
export function rememberConfigRow(row: RemoteConfigRow): void;
export function buildUpsertPayload(
  key: string,
  scope: string,
  value: unknown,
): { key: string; scope: string; value: unknown; version?: number };
export function clearConfigVersionsForTests(): void;

// apps/web-admin/src/features/inventory/stock-query-access.ts
export function canQueryStockCatalog(role: string | null): boolean;
export function canQueryStockAdmin(role: string | null): boolean;

// apps/web-admin/src/shared/auth/session.ts
export function getSessionUserRole(): string | null;
```

`persistRemoteConfig(key, scope, value)` sigue siendo fire-and-forget (`void`); su firma pública **no cambia**. Lo que cambia es el body que manda.

---

### Task 1: RBAC — catálogo de stock para el POS

**Files:**
- Modify: `apps/api/src/common/roles.ts`
- Modify: `apps/api/src/stock/stock.controller.ts`
- Modify: `apps/api/test/integration/platform-migration-deep.test.ts`

**Interfaces:**
- Consumes: `ADMIN_ROLES`, `ROLES.VENDEDOR`, `ROLES.GERENTE_VENTAS`, `hasAnyRole` ya existentes.
- Produces: `STOCK_POS_READ_ROLES`. `STOCK_MUTATION_ROLES` queda `Admin + SuperAdmin + Operador_Stock`.

- [ ] **Step 1: Extender la matriz RBAC que ya falla el caso Vendedor**

En `apps/api/test/integration/platform-migration-deep.test.ts`, el import de roles (líneas 32–38) y el describe `'Seguridad — matriz RBAC inventario'` (líneas 101–125) se amplían así. Dejar los its existentes. Agregar `STOCK_POS_READ_ROLES` al import:

```ts
import {
  hasAnyRole,
  STOCK_MUTATION_ROLES,
  STOCK_READ_ROLES,
  STOCK_POS_READ_ROLES,
  SALES_CATALOG_ROLES,
  FOOTBALL_MUTATION_ROLES,
  ONLINE_MUTATION_ROLES,
} from '../../src/common/roles';
```

Agregar estos its **dentro** del describe de matriz RBAC, después de `'Vendedor no puede mutar catálogo de inventario'`:

```ts
  it('Vendedor y Gerente_Ventas pueden leer el catálogo de insumos del POS', () => {
    expect(hasAnyRole('Vendedor', STOCK_POS_READ_ROLES)).toBe(true);
    expect(hasAnyRole('Gerente_Ventas', STOCK_POS_READ_ROLES)).toBe(true);
    expect(hasAnyRole('Vendedor', STOCK_READ_ROLES)).toBe(false);
    expect(hasAnyRole('Gerente_Ventas', STOCK_READ_ROLES)).toBe(false);
  });

  it('Vendedor sigue sin mutar inventario aunque pueda leer el catálogo POS', () => {
    expect(hasAnyRole('Vendedor', STOCK_MUTATION_ROLES)).toBe(false);
    expect(hasAnyRole('Gerente_Ventas', STOCK_MUTATION_ROLES)).toBe(false);
    expect(hasAnyRole('Operador_Stock', STOCK_MUTATION_ROLES)).toBe(true);
  });

  it('Operador_Futbol y Operador_Cocina no leen catálogo de stock', () => {
    expect(hasAnyRole('Operador_Futbol', STOCK_POS_READ_ROLES)).toBe(false);
    expect(hasAnyRole('Operador_Cocina', STOCK_POS_READ_ROLES)).toBe(false);
  });
```

- [ ] **Step 2: Correr el test — debe fallar**

Run, desde `apps/api`:

```bash
npx vitest run test/integration/platform-migration-deep.test.ts
```

Expected: FAIL — `STOCK_POS_READ_ROLES is not defined` (o el import no resuelve).

- [ ] **Step 3: Declarar `STOCK_POS_READ_ROLES` sin ensanchar mutaciones**

En `apps/api/src/common/roles.ts`, reemplazar el bloque de inventario (líneas 49–52) por:

```ts
/** Lectura del módulo Inventario (sidebar admin: proveedores, OC, movimientos, conteos). */
export const STOCK_READ_ROLES = [...ADMIN_ROLES, ROLES.OPERADOR_STOCK] as const;

/**
 * Lectura del catálogo de insumos que el POS necesita para saber qué se puede
 * vender / consumir (productos + niveles + almacenes + categorías).
 * No incluye proveedores, órdenes de compra, movimientos ni conteos.
 */
export const STOCK_POS_READ_ROLES = [
  ...STOCK_READ_ROLES,
  ROLES.VENDEDOR,
  ROLES.GERENTE_VENTAS,
] as const;

/** Mutar inventario. Anclado a STOCK_READ_ROLES, NUNCA a STOCK_POS_READ_ROLES. */
export const STOCK_MUTATION_ROLES = [...STOCK_READ_ROLES] as const;
export const STOCK_COUNT_ROLES = [...STOCK_MUTATION_ROLES] as const;
```

- [ ] **Step 4: Cablear los GET de catálogo en el controller**

En `apps/api/src/stock/stock.controller.ts`, agregar `STOCK_POS_READ_ROLES` al import de `../common/roles`. Cambiar **solo** estos cinco handlers (el resto de `@Get` se queda en `STOCK_READ_ROLES`):

- `@Get('products')` → `@Roles(...STOCK_POS_READ_ROLES)`
- `@Get('products/:id')` → `@Roles(...STOCK_POS_READ_ROLES)`
- `@Get('products/:id/stock')` → `@Roles(...STOCK_POS_READ_ROLES)`
- `@Get('warehouses')` → `@Roles(...STOCK_POS_READ_ROLES)`
- `@Get('categories')` → `@Roles(...STOCK_POS_READ_ROLES)`

No tocar `@Post`/`@Put`/`@Delete`. No tocar `movements`, `count-sessions`, `suppliers`, `purchase-orders`.

- [ ] **Step 5: Correr los tests — deben pasar**

Run, desde `apps/api`:

```bash
npx vitest run test/integration/platform-migration-deep.test.ts
npm test
```

Expected: el archivo deep en verde; `npm test` verde (hoy ~209).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/roles.ts apps/api/src/stock/stock.controller.ts apps/api/test/integration/platform-migration-deep.test.ts
git commit -m "fix(api): el POS puede leer insumos sin mutar inventario"
```

---

### Task 2: Front — no disparar queries de inventario prohibidas

**Files:**
- Create: `apps/web-admin/src/features/inventory/stock-query-access.ts`
- Create: `apps/web-admin/src/features/inventory/stock-query-access.test.ts`
- Modify: `apps/web-admin/src/shared/auth/session.ts`
- Create: `apps/web-admin/src/shared/auth/session.test.ts`
- Modify: `apps/web-admin/src/features/inventory/use-inventory-state.ts`

**Interfaces:**
- Consumes: `canAccessModule` de `apps/web-admin/src/features/platform/config/modules.ts`; `STOCK_POS_READ_ROLES` ya vive en el backend (esta task no lo reimplementa, replica la matriz en el front porque el client no importa `roles.ts` de Nest).
- Produces: `getSessionUserRole(): string | null`; `canQueryStockCatalog(role)`; `canQueryStockAdmin(role)`.

Por qué hace falta: `useAppState` monta `useInventoryState` para **todos** los roles. Hoy Vendedor dispara `movements`/`suppliers`/`orders`/`countSessions`, toma 403, y el `queryCache.subscribe` de Proyecto C le muestra un toast en cada login. Aunque Task 1 deje pasar `products`, los otros GET siguen en 403.

- [ ] **Step 1: Tests de `getSessionUserRole` y de la matriz de queries**

Crear `apps/web-admin/src/shared/auth/session.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import { storageKeys } from '@/shared/storage/keys';
import { getSessionUserId, getSessionUserRole } from './session';

afterEach(() => {
  localStorage.removeItem(storageKeys.auth.user);
});

describe('getSessionUserRole', () => {
  it('devuelve null si no hay sesión', () => {
    expect(getSessionUserRole()).toBeNull();
  });

  it('lee el rol de lch-auth-user', () => {
    localStorage.setItem(
      storageKeys.auth.user,
      JSON.stringify({ id: '550e8400-e29b-41d4-a716-446655440000', role: 'Vendedor' }),
    );
    expect(getSessionUserRole()).toBe('Vendedor');
  });

  it('devuelve null si el JSON está roto', () => {
    localStorage.setItem(storageKeys.auth.user, '{nope');
    expect(getSessionUserRole()).toBeNull();
    expect(getSessionUserId()).toBeNull();
  });
});
```

Crear `apps/web-admin/src/features/inventory/stock-query-access.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canQueryStockAdmin, canQueryStockCatalog } from './stock-query-access';

describe('stock-query-access', () => {
  it('Vendedor y Gerente leen catálogo POS, no el admin de inventario', () => {
    expect(canQueryStockCatalog('Vendedor')).toBe(true);
    expect(canQueryStockCatalog('Gerente_Ventas')).toBe(true);
    expect(canQueryStockAdmin('Vendedor')).toBe(false);
    expect(canQueryStockAdmin('Gerente_Ventas')).toBe(false);
  });

  it('Operador_Stock y SuperAdmin leen catálogo y admin', () => {
    expect(canQueryStockCatalog('Operador_Stock')).toBe(true);
    expect(canQueryStockAdmin('Operador_Stock')).toBe(true);
    expect(canQueryStockCatalog('SuperAdmin')).toBe(true);
    expect(canQueryStockAdmin('SuperAdmin')).toBe(true);
    expect(canQueryStockCatalog('Admin')).toBe(true);
    expect(canQueryStockAdmin('Admin')).toBe(true);
  });

  it('fútbol/cocina y sesión vacía no disparan nada', () => {
    expect(canQueryStockCatalog('Operador_Futbol')).toBe(false);
    expect(canQueryStockCatalog('Operador_Cocina')).toBe(false);
    expect(canQueryStockCatalog(null)).toBe(false);
    expect(canQueryStockCatalog('')).toBe(false);
    expect(canQueryStockAdmin(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run, desde `apps/web-admin`:

```bash
npx vitest run src/shared/auth/session.test.ts src/features/inventory/stock-query-access.test.ts
```

Expected: FAIL — `getSessionUserRole is not a function` / `stock-query-access` no existe.

- [ ] **Step 3: Implementar `getSessionUserRole`**

En `apps/web-admin/src/shared/auth/session.ts`, agregar al lado de `getSessionUserId`:

```ts
export function getSessionUserRole(): string | null {
  try {
    const raw = localStorage.getItem(storageKeys.auth.user);
    if (!raw) return null;
    const user = JSON.parse(raw) as { role?: unknown };
    return typeof user.role === 'string' && user.role.length > 0 ? user.role : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Implementar `stock-query-access.ts`**

Crear `apps/web-admin/src/features/inventory/stock-query-access.ts`:

```ts
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
```

- [ ] **Step 5: `enabled` en cada query de `use-inventory-state.ts`**

Al inicio de `useInventoryState`, después de `const queryClient = useQueryClient();`:

```ts
  const role = getSessionUserRole();
  const catalogEnabled = canQueryStockCatalog(role);
  const adminEnabled = canQueryStockAdmin(role);
```

Imports a agregar:

```ts
import { getSessionUserRole } from '@/shared/auth/session';
import { canQueryStockAdmin, canQueryStockCatalog } from './stock-query-access';
```

En cada `useQuery` existente, agregar `enabled`:

- `categoriesQuery`, `warehousesQuery`, `productsQuery` → `enabled: catalogEnabled`
- `movementsQuery`, `countSessionsQuery`, `suppliersQuery`, `ordersQuery` → `enabled: adminEnabled`

Ejemplo del de productos (el resto igual, solo cambia el flag):

```ts
  const productsQuery = useQuery({
    queryKey: ['inventory', 'products'],
    queryFn: () => stockApi.products.list().then(rows => rows.map(mapApiProductToLocal)),
    enabled: catalogEnabled,
  });
```

No cambiar los `useEffect` de merge: si `data === undefined` (query deshabilitada) ya hacen `return` y dejan el seed local, que un Operador_Futbol nunca ve.

- [ ] **Step 6: Correr tests + types**

Run, desde `apps/web-admin`:

```bash
npx vitest run src/shared/auth/session.test.ts src/features/inventory/stock-query-access.test.ts
npx vitest run
npx tsc --noEmit
```

Expected: PASS. `tsc` sin errores nuevos.

- [ ] **Step 7: Commit**

```bash
git add apps/web-admin/src/shared/auth/session.ts apps/web-admin/src/shared/auth/session.test.ts apps/web-admin/src/features/inventory/stock-query-access.ts apps/web-admin/src/features/inventory/stock-query-access.test.ts apps/web-admin/src/features/inventory/use-inventory-state.ts
git commit -m "fix(admin): el POS lee insumos y no dispara 403 de inventario"
```

---

### Task 3: `persistRemoteConfig` manda `version`

**Files:**
- Create: `apps/web-admin/src/shared/utils/config-versions.ts`
- Create: `apps/web-admin/src/shared/utils/config-versions.test.ts`
- Modify: `apps/web-admin/src/shared/utils/remote-config.ts`

**Interfaces:**
- Consumes: `settingsApi.config.upsert` ya acepta `version?: number` (`client.ts` línea 888). Backend `upsertConfig` ya hace 409 (`settings.service.ts` líneas 29–55). Mensaje: `OPTIMISTIC_LOCK_MESSAGE` = `'Este registro fue modificado por otra persona. Recargá la página y volvé a intentar.'`
- Produces: `rememberConfigRows`, `rememberConfigRow`, `buildUpsertPayload`, `clearConfigVersionsForTests`. Firma de `persistRemoteConfig` **sin cambios**.

- [ ] **Step 1: Tests del mapa de versiones**

Crear `apps/web-admin/src/shared/utils/config-versions.test.ts`:

```ts
import { describe, expect, it, beforeEach } from 'vitest';
import {
  buildUpsertPayload,
  clearConfigVersionsForTests,
  rememberConfigRow,
  rememberConfigRows,
} from './config-versions';

describe('config-versions', () => {
  beforeEach(() => {
    clearConfigVersionsForTests();
  });

  it('sin fila previa, el upsert va sin version (alta)', () => {
    expect(buildUpsertPayload('sales.ticketTemplate', 'sales', { a: 1 })).toEqual({
      key: 'sales.ticketTemplate',
      scope: 'sales',
      value: { a: 1 },
    });
  });

  it('después de listar, el upsert manda la version leída', () => {
    rememberConfigRows([
      { key: 'sales.ticketTemplate', scope: 'sales', value: { a: 1 }, version: 3 },
    ]);
    expect(buildUpsertPayload('sales.ticketTemplate', 'sales', { a: 2 })).toEqual({
      key: 'sales.ticketTemplate',
      scope: 'sales',
      value: { a: 2 },
      version: 3,
    });
  });

  it('después de un upsert exitoso, la próxima usa version+1 si el server devolvió version', () => {
    rememberConfigRow({
      key: 'futbol.matchNotifications',
      scope: 'futbol',
      value: true,
      version: 1,
    });
    expect(buildUpsertPayload('futbol.matchNotifications', 'futbol', false).version).toBe(1);
  });

  it('version ausente o no numérica se trata como alta', () => {
    rememberConfigRows([
      { key: 'k', scope: 's', value: 1 },
      { key: 'k2', scope: 's', value: 1, version: Number.NaN },
    ]);
    expect(buildUpsertPayload('k', 's', 2).version).toBeUndefined();
    expect(buildUpsertPayload('k2', 's', 2).version).toBeUndefined();
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run, desde `apps/web-admin`:

```bash
npx vitest run src/shared/utils/config-versions.test.ts
```

Expected: FAIL — módulo no existe.

- [ ] **Step 3: Implementar el mapa**

Crear `apps/web-admin/src/shared/utils/config-versions.ts`:

```ts
export type RemoteConfigRow = {
  key: string;
  scope: string;
  value: unknown;
  version?: number;
};

const versions = new Map<string, number>();

function isVersion(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0;
}

export function clearConfigVersionsForTests(): void {
  versions.clear();
}

export function rememberConfigRow(row: RemoteConfigRow): void {
  if (isVersion(row.version)) versions.set(row.key, row.version);
}

export function rememberConfigRows(rows: RemoteConfigRow[]): void {
  for (const row of rows) rememberConfigRow(row);
}

export function buildUpsertPayload(
  key: string,
  scope: string,
  value: unknown,
): { key: string; scope: string; value: unknown; version?: number } {
  const version = versions.get(key);
  if (version === undefined) return { key, scope, value };
  return { key, scope, value, version };
}
```

- [ ] **Step 4: `persistRemoteConfig` usa el mapa y avisa el 409**

Reemplazar `apps/web-admin/src/shared/utils/remote-config.ts` entero:

```ts
import { settingsApi, getApiErrorMessage } from '@/app/api/client';
import { notifyError } from '@/shared/notify';
import { buildUpsertPayload, rememberConfigRow } from './config-versions';

export function persistRemoteConfig(key: string, scope: string, value: unknown): void {
  const payload = buildUpsertPayload(key, scope, value);
  void settingsApi.config.upsert(payload, '').then(
    (row) => {
      rememberConfigRow(row);
    },
    (error) => {
      const message = getApiErrorMessage(error, 'No se pudo guardar la configuración');
      notifyError(message);
      if (typeof window !== 'undefined') {
        window.alert(message);
      }
    },
  );
}
```

`isApiError` no hace falta importar. El toast (`notifyError`) cubre a quien no mira el `alert`; el `alert` se queda porque hoy `persistRemoteConfig` ya alerta y el 409 pide recargar.

- [ ] **Step 5: Correr tests**

Run, desde `apps/web-admin`:

```bash
npx vitest run src/shared/utils/config-versions.test.ts src/shared/notify.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/shared/utils/config-versions.ts apps/web-admin/src/shared/utils/config-versions.test.ts apps/web-admin/src/shared/utils/remote-config.ts
git commit -m "fix(admin): la config remota manda version y avisa el 409"
```

---

### Task 4: Settings de fútbol/online/stock/ventas vía `useQuery`

**Files:**
- Modify: `apps/web-admin/src/features/futbol/use-futbol-settings.ts`
- Modify: `apps/web-admin/src/features/online/use-online-settings.ts`
- Modify: `apps/web-admin/src/features/platform/use-platform-state.ts`
- Modify: `apps/web-admin/src/features/sales/use-sales-state.ts`
- Modify: `apps/web-admin/src/shared/storage/keys.ts`

**Interfaces:**
- Consumes: `rememberConfigRows` / `persistRemoteConfig` de Task 3; `settingsApi.config.list(scope)` ya existe.
- Produces: mismos setters públicos de cada hook (`setMatchNotifications`, `setValidateStockOnSale`, etc.). Las pantallas no cambian.

Patrón idéntico en los cuatro hooks: un `useQuery` por scope, `rememberConfigRows` al resolver, aplicar valores conocidos al state, setters siguen llamando `persistRemoteConfig`.

- [ ] **Step 1: `use-futbol-settings.ts`**

Reemplazar el `useEffect` de hydrate silencioso por:

```ts
import { useQuery } from '@tanstack/react-query';
import { rememberConfigRows } from '@/shared/utils/config-versions';
```

Dentro de `useFutbolSettings`, **sacar** el `useEffect` que llama `settingsApi.config.list('futbol')`. Dejar los `useLocalStorage` como valor inicial (offline) y agregar:

```ts
  useQuery({
    queryKey: ['settings', 'config', 'futbol'],
    queryFn: async () => {
      const rows = await settingsApi.config.list('futbol');
      rememberConfigRows(rows);
      return rows;
    },
  });
```

Aplicar el resultado con un `useEffect` que **sí** avisa si la query falló (React Query + `queryCache.subscribe` de Proyecto C ya muestran el toast; no hacer `.catch(() => undefined)`):

```ts
  const configQuery = useQuery({
    queryKey: ['settings', 'config', 'futbol'],
    queryFn: async () => {
      const rows = await settingsApi.config.list('futbol');
      rememberConfigRows(rows);
      return rows;
    },
  });

  useEffect(() => {
    if (!configQuery.data) return;
    for (const row of configQuery.data) {
      if (row.key === 'futbol.matchNotifications' && typeof row.value === 'boolean') {
        setMatchNotificationsState(row.value);
      }
      if (row.key === 'futbol.defaultCategory' && typeof row.value === 'string') {
        setDefaultCategoryState(row.value as FutbolTournamentCategory);
      }
    }
  }, [configQuery.data, setMatchNotificationsState, setDefaultCategoryState]);
```

Los setters **no se tocan** (siguen con `persistRemoteConfig`).

- [ ] **Step 2: `use-online-settings.ts` — mismo patrón, scope `online`**

`queryKey: ['settings', 'config', 'online']`.

Claves a aplicar, iguales a las del `useEffect` actual:

- `online.orderNotifications` boolean → `setOrderNotificationsState`
- `online.syncCatalogWithStock` boolean → `setSyncCatalogWithStockState`
- `online.webChannelEnabled` boolean → `setWebChannelEnabledState`
- `online.appChannelEnabled` boolean → `setAppChannelEnabledState`

- [ ] **Step 3: `use-platform-state.ts` — solo settings de stock**

`queryKey: ['settings', 'config', 'stock']`.

Aplicar:

- `stock.alertDay` string → `setStockAlertDayState`
- `stock.lowStockNotifications` boolean → `setStockLowNotificationsState`
- `stock.autoAlerts` boolean → `setStockAutoAlertsState`
- `stock.packRounding` boolean → `setStockPackRoundingState`

**No** hidratar `darkMode` ni `notificationsEnabled`/`notificationSound` desde el server: son preferencia de dispositivo.

Sacar el `useEffect` actual de `settingsApi.config.list('stock')` (líneas 60–69).

- [ ] **Step 4: `use-sales-state.ts` — scope `sales`**

Después de los `useLocalStorage` de `ticketTemplate` / `validateStockOnSale` / `raceConditionProtection`, agregar:

```ts
  const salesConfigQuery = useQuery({
    queryKey: ['settings', 'config', 'sales'],
    queryFn: async () => {
      const rows = await settingsApi.config.list('sales');
      rememberConfigRows(rows);
      return rows;
    },
  });

  useEffect(() => {
    if (!salesConfigQuery.data) return;
    for (const row of salesConfigQuery.data) {
      if (row.key === 'sales.ticketTemplate' && row.value && typeof row.value === 'object') {
        setTicketTemplate(row.value as TicketTemplate);
      }
      if (row.key === 'sales.validateStockOnSale' && typeof row.value === 'boolean') {
        setValidateStockOnSale(row.value);
      }
      if (row.key === 'sales.raceConditionProtection' && typeof row.value === 'boolean') {
        setRaceConditionProtection(row.value);
      }
    }
  }, [salesConfigQuery.data, setTicketTemplate, setValidateStockOnSale, setRaceConditionProtection]);
```

Import: `rememberConfigRows` desde `@/shared/utils/config-versions`. `useQuery` ya está importado en este archivo.

- [ ] **Step 5: Marcar keys legacy en `storage/keys.ts`**

En el comentario de `storageKeys.futbol` / `online` / `inventory.alertDay` (etc.), agregar al lado: `// se escribe local y se pisa con React Query (Task 4, 2026-09-10)`. No borrar las keys.

- [ ] **Step 6: Verificar**

Run, desde `apps/web-admin`:

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: tests verdes; `tsc` limpio; build OK.

- [ ] **Step 7: Commit**

```bash
git add apps/web-admin/src/features/futbol/use-futbol-settings.ts apps/web-admin/src/features/online/use-online-settings.ts apps/web-admin/src/features/platform/use-platform-state.ts apps/web-admin/src/features/sales/use-sales-state.ts apps/web-admin/src/shared/storage/keys.ts
git commit -m "feat(admin): settings de fútbol, online, stock y ventas vía React Query"
```

---

### Task 5: Cocina y overviews vía `useQuery`

**Files:**
- Modify: `apps/web-admin/src/features/kitchen/use-kitchen-state.ts`
- Modify: `apps/web-admin/src/features/futbol/futbol-shared.tsx` (`useFutbolOverview`)
- Modify: `apps/web-admin/src/features/online/online-shared.tsx` (`useOnlineOverview`)
- Modify: `apps/web-admin/src/shared/storage/keys.ts` (`kitchen.orders` → legacy)

**Interfaces:**
- Consumes: `kitchenApi.orders.list()`, `footballApi.overview`, `onlineApi.overview` ya existentes. Firma pública de los tres hooks **sin cambios** (`kitchenOrders`/`setKitchenOrders`; `{ data, loading, error, reload, torneoId, setTorneoId }`; `{ data, loading, error, reload }`).
- Produces: nada nuevo para otras tasks.

- [ ] **Step 1: Reescribir `use-kitchen-state.ts`**

Reemplazar el archivo por:

```ts
import { useQuery } from '@tanstack/react-query';
import { kitchenApi } from '@/app/api/client';
import type { KitchenOrder } from './types';

function mapApiKitchenOrder(row: {
  id: string;
  ticketId: string;
  ticketNumber: number;
  kitchenId: string;
  status: KitchenOrder['status'];
  operatorName: string;
  tableId?: string | null;
  tableName?: string | null;
  createdAt: string;
  updatedAt: string;
  kitchen?: { name?: string } | null;
  items: { salesProductId: string; name: string; quantity: number; emoji?: string | null }[];
}): KitchenOrder {
  return {
    id: row.id,
    ticketId: row.ticketId,
    ticketNumber: row.ticketNumber,
    kitchenId: row.kitchenId,
    kitchenName: row.kitchen?.name ?? '',
    items: row.items.map(i => ({
      salesProductId: i.salesProductId,
      name: i.name,
      quantity: i.quantity,
      emoji: i.emoji ?? '',
    })),
    status: row.status,
    createdAtISO: row.createdAt,
    updatedAtISO: row.updatedAt,
    operatorName: row.operatorName,
    tableId: row.tableId ?? undefined,
    tableName: row.tableName ?? undefined,
  };
}

export function useKitchenState() {
  const query = useQuery({
    queryKey: ['kitchen', 'orders'],
    queryFn: () => kitchenApi.orders.list().then(rows => rows.map(mapApiKitchenOrder)),
  });

  return {
    kitchenOrders: query.data ?? [],
    setKitchenOrders: (
      _next: KitchenOrder[] | ((prev: KitchenOrder[]) => KitchenOrder[]),
    ) => {
      // El KDS muta por kitchenApi.orders.transition, no por este setter.
      // Se deja la firma para no romper useAppState / notificaciones.
    },
  };
}

export type KitchenState = ReturnType<typeof useKitchenState>;
```

`use-pending-notifications.ts` sigue leyendo `kitchenOrders` y filtrando `pending`/`preparing`. No se toca.

En `storage/keys.ts`, marcar `kitchen.orders` como `// legacy — React Query Task 5, 2026-09-10`.

- [ ] **Step 2: `useFutbolOverview` con `useQuery`**

En `apps/web-admin/src/features/futbol/futbol-shared.tsx`, reemplazar el `useState`+`useEffect` de `useFutbolOverview` por:

```ts
import { useQuery } from '@tanstack/react-query';

export function useFutbolOverview() {
  const [searchParams, setSearchParams] = useSearchParams();
  const torneoIdParam = searchParams.get('torneoId') ?? '';

  const query = useQuery({
    queryKey: ['football', 'overview', torneoIdParam],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) throw new Error('Sesión requerida');
      return footballApi.overview(token, torneoIdParam || undefined);
    },
  });

  function setTorneoId(id: string) {
    const sp = new URLSearchParams(searchParams);
    if (id) sp.set('torneoId', id);
    else sp.delete('torneoId');
    setSearchParams(sp, { replace: true });
  }

  const torneoId = query.data?.torneo?.id ?? (torneoIdParam || null);

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error instanceof Error ? query.error.message : 'Error al cargar') : null,
    reload: () => {
      void query.refetch();
    },
    torneoId,
    setTorneoId,
  };
}
```

El import de React en este archivo pasa a ser solo:

```ts
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { footballApi, getAccessToken } from '@/app/api/client';
```

Los helpers `futbolFieldClass` / `FutbolPanelShell` no usan hooks. No reintroducir `useState`/`useEffect`/`useCallback`.

- [ ] **Step 3: `useOnlineOverview` con `useQuery`**

En `apps/web-admin/src/features/online/online-shared.tsx`, reemplazar `useOnlineOverview` por:

```ts
import { useQuery } from '@tanstack/react-query';
import { onlineApi, getAccessToken, type OnlineOverview } from '@/app/api/client';

export function useOnlineOverview() {
  const query = useQuery({
    queryKey: ['online', 'overview'],
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) throw new Error('Sesión requerida');
      return onlineApi.overview(token);
    },
  });

  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? (query.error instanceof Error ? query.error.message : 'Error al cargar') : null,
    reload: () => {
      void query.refetch();
    },
  };
}
```

El import de React en este archivo se elimina por completo (los helpers `onlineFieldClass` / `OnlinePanelShell` no usan hooks). Queda:

```ts
import { useQuery } from '@tanstack/react-query';
import { onlineApi, getAccessToken } from '@/app/api/client';
```

- [ ] **Step 4: Verificar**

Run, desde `apps/web-admin`:

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: verde. Grep de control: `useLocalStorage` **no** debe quedar en `use-kitchen-state.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web-admin/src/features/kitchen/use-kitchen-state.ts apps/web-admin/src/features/futbol/futbol-shared.tsx apps/web-admin/src/features/online/online-shared.tsx apps/web-admin/src/shared/storage/keys.ts
git commit -m "feat(admin): cocina y overviews de fútbol/online vía React Query"
```

---

### Task 6: Historial de tickets con cursor

**Files:**
- Modify: `apps/api/src/sales/sales.service.ts` (`findAllTickets`)
- Create: `apps/api/test/db/tickets-cursor.test.ts`
- Create: `apps/web-admin/src/app/api/cursor-page.ts`
- Create: `apps/web-admin/src/app/api/cursor-page.test.ts`
- Modify: `apps/web-admin/src/app/api/client.ts` (`salesApi.tickets`)
- Modify: `apps/web-admin/src/features/sales/pos/HistoryModule.tsx`

**Interfaces:**
- Consumes: `normalizeLimit` + `toCursorPage` de `apps/api/src/common/pagination.ts`. Contrato de productos: **sin cursor y sin limit → array; con limit (cursor opcional) → `CursorPage`**.
- Produces: `salesApi.tickets.list()` sin cambios (POS, últimos 100). `salesApi.tickets.listPage({ cursor?, limit }): Promise<CursorPage<SalesTicket>>`.

Hoy `findAllTickets` si `cursor === undefined` **siempre** devuelve array (`take: 100` o `limit`). No hay forma de obtener `nextCursor` en la primera página. Hay que alinearlo al de productos **antes** de cablear el Historial.

- [ ] **Step 1: Test Postgres del contrato de tickets**

Crear `apps/api/test/db/tickets-cursor.test.ts`. El modelo `TicketVenta` (`schema.prisma` ~387) **no tiene `subtotal`**. `origen` es el enum `OrigenTicket`: `pos | online | consumo`. `resetTestDb` trunca todo, así que hay que crear el operador. El constructor es `new SalesService(prisma, movements)` — igual que `apps/api/test/db/sales-consumption.test.ts`.

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { SalesService } from '../../src/sales/sales.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;

function salesService() {
  return new SalesService(prismaAsService, new StockMovementsService(prismaAsService));
}

describe('paginación por cursor (TicketVenta) contra Postgres real', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function seedTickets(n: number) {
    const user = await prisma.usuario.create({
      data: { username: 'op-hist', name: 'Operador', role: 'Vendedor', password: 'x' },
    });
    for (let i = 0; i < n; i++) {
      await prisma.ticketVenta.create({
        data: {
          number: 2000 + i,
          total: i,
          origen: 'pos',
          status: 'emitido',
          operatorId: user.id,
        },
      });
    }
  }

  it('sin cursor ni limit devuelve un array (compat POS)', async () => {
    await seedTickets(3);
    const all = await salesService().findAllTickets();
    expect(Array.isArray(all)).toBe(true);
    expect(all).toHaveLength(3);
  });

  it('con limit y sin cursor devuelve { items, nextCursor }', async () => {
    await seedTickets(5);
    const sales = salesService();
    const page = await sales.findAllTickets(undefined, undefined, undefined, 2);
    expect(Array.isArray(page)).toBe(false);
    expect(page.items).toHaveLength(2);
    expect(page.nextCursor).toBeTruthy();

    const page2 = await sales.findAllTickets(undefined, undefined, page.nextCursor, 2);
    expect(page2.items).toHaveLength(2);
    const ids = [...page.items, ...page2.items].map(t => t.id);
    expect(new Set(ids).size).toBe(4);
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run, desde `apps/api`:

```bash
npm run test:db -- test/db/tickets-cursor.test.ts
```

Expected: FAIL — `page.items` undefined porque hoy `limit` sin `cursor` devuelve array.

- [ ] **Step 3: Alinear `findAllTickets` al contrato de productos**

En `apps/api/src/sales/sales.service.ts`, reemplazar el cuerpo de `findAllTickets` (el `if (cursor === undefined)` actual) por:

```ts
    if (cursor === undefined && limit === undefined) {
      return this.prisma.ticketVenta.findMany({
        where, include, orderBy: { createdAt: 'desc' }, take: 100,
      });
    }
    const take = normalizeLimit(limit);
    const rows = await this.prisma.ticketVenta.findMany({
      where,
      include,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: take + 1,
    });
    return toCursorPage(rows, take);
```

Dejar los overloads TypeScript que ya están (array vs `CursorPage`). `import { normalizeLimit, toCursorPage }` ya existe en este archivo (Task 9 de Plan B).

- [ ] **Step 4: Correr test:db — debe pasar**

Run, desde `apps/api`:

```bash
npm run test:db -- test/db/tickets-cursor.test.ts
npm test
```

Expected: PASS.

- [ ] **Step 5: Type guard + `listPage` en el client**

Crear `apps/web-admin/src/app/api/cursor-page.ts`:

```ts
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function isCursorPage<T>(value: unknown): value is CursorPage<T> {
  if (typeof value !== 'object' || value === null) return false;
  const row = value as { items?: unknown; nextCursor?: unknown };
  return Array.isArray(row.items) && (row.nextCursor === null || typeof row.nextCursor === 'string');
}
```

Crear `apps/web-admin/src/app/api/cursor-page.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isCursorPage } from './cursor-page';

describe('isCursorPage', () => {
  it('acepta una página bien formada', () => {
    expect(isCursorPage({ items: [{ id: 'a' }], nextCursor: 'a' })).toBe(true);
    expect(isCursorPage({ items: [], nextCursor: null })).toBe(true);
  });

  it('rechaza un array plano (respuesta POS)', () => {
    expect(isCursorPage([{ id: 'a' }])).toBe(false);
  });
});
```

En `apps/web-admin/src/app/api/client.ts`, junto a `salesApi.tickets.list`, agregar `listPage`. Dejar `list` intacto:

```ts
    listPage: (params?: { status?: string; cursor?: string; limit?: number }) => {
      const q = new URLSearchParams();
      if (params?.status) q.set('status', params.status);
      if (params?.cursor) q.set('cursor', params.cursor);
      if (params?.limit != null) q.set('limit', String(params.limit));
      const qs = q.toString();
      return apiFetch<CursorPage<SalesTicket>>(`/sales/tickets${qs ? `?${qs}` : '?limit=50'}`);
    },
```

Importar `CursorPage` desde `./cursor-page`. Si `SalesTicket` se declara más abajo en el mismo archivo, TypeScript lo acepta (el objeto `salesApi` ya usa `SalesTicket[]` en `list`).

Forzar `?limit=50` cuando no hay params para **nunca** pegarle al branch array del backend.

- [ ] **Step 6: HistoryModule — `useInfiniteQuery` + Cargar más**

`ticketToPos` vive en `VentasPosContext.tsx` línea 155 (hoy no exportada). Firma real:

```ts
function ticketToPos(ticket: SalesTicket, operatorName: string, kitchens: Kitchen[]): PosTicket
```

`SalesTicket` acá es el tipo **local** de `@/features/sales/types`. La API usa el `SalesTicket` de `client.ts` (alias `ApiSalesTicket` en `sales-mappers.ts`). Cadena:

`listPage` → `ApiSalesTicket[]` → `mapApiTicketToLocal(api, salesProducts, currentUser.name)` → `ticketToPos(...)` → `PosTicket` (el `Ticket` que ya usa HistoryModule).

`salesProducts` **no** está en `useStore()`. Sale de `useAppContext()`.

1. En `VentasPosContext.tsx` línea 155, agregar `export` delante de `function ticketToPos`. No tocar el cuerpo.

2. Reemplazar el bloque de imports y el inicio de `HistoryModule` en `HistoryModule.tsx`:

```ts
import { useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Ban, Receipt, RotateCcw, Clock, UserMinus } from "lucide-react";
import { useStore, ticketToPos, type Ticket } from "./VentasPosContext";
import { EditableOrderModal } from "./EditableOrderModal";
import { useAppContext } from '@/app/providers/AppContext';
import { salesApi } from "@/app/api/client";
import { mapApiTicketToLocal } from "@/features/sales/api/sales-mappers";
import { getVentasAuditEntries } from '@/shared/utils/audit-log';
import { AuditHistoryTable } from '@/shared/components/AuditHistoryTable';
```

`Ticket` ya está exportado (`export type Ticket = PosTicket` en `VentasPosContext.tsx` línea 1045). El import de HistoryModule pasa a `import { useStore, ticketToPos, type Ticket } from "./VentasPosContext"`.

3. Dentro de `HistoryModule`, reemplazar el `useStore()` actual por:

```ts
  const { users, replaceTicketItems, voidTicket, products, setToast, currentUser, kitchens } =
    useStore();
  const { auditLog, salesAuditLog, salesProducts } = useAppContext();
  const queryClient = useQueryClient();
  const historyQuery = useInfiniteQuery({
    queryKey: ['sales', 'tickets', 'history'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      salesApi.tickets.listPage({ cursor: pageParam, limit: 50 }),
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });

  const tickets = useMemo(() => {
    const pages = historyQuery.data?.pages ?? [];
    return pages.flatMap((p) =>
      p.items.map((api) =>
        ticketToPos(mapApiTicketToLocal(api, salesProducts, currentUser.name), currentUser.name, kitchens),
      ),
    );
  }, [historyQuery.data, salesProducts, currentUser.name, kitchens]);
```

`useStore()` ya expone `currentUser` y `kitchens` (`VentasPosContext.tsx` value, ~líneas 989–990). `salesProducts` sale de `useAppContext()`. `Ticket` ya está exportado (`export type Ticket = PosTicket` al final del context).

El `filtered` / `stats` que hoy recorren `tickets` siguen igual — ahora `tickets` son las páginas cargadas, no el store del POS.

4. Debajo de `<h3 className="text-foreground mb-3">Resumen por Operador</h3>` agregar:

```tsx
        <p className="text-xs text-muted-foreground mb-3">
          Totales sobre los tickets cargados en esta pantalla, no sobre toda la historia.
        </p>
```

5. Después del `</div>` de la lista de tickets (antes de `{orderModal && (`), agregar:

```tsx
      {historyQuery.hasNextPage && (
        <button
          type="button"
          className="w-full rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground hover:bg-muted"
          disabled={historyQuery.isFetchingNextPage}
          onClick={() => { void historyQuery.fetchNextPage(); }}
        >
          {historyQuery.isFetchingNextPage ? 'Cargando…' : 'Cargar más'}
        </button>
      )}
```

6. `voidTicket` es `Promise<PosTicket | null>` (`VentasPosContext.tsx` línea 99). En `EditableOrderModal`:

```ts
          onSave={async (id, items) => {
            await replaceTicketItems(id, items);
            void queryClient.invalidateQueries({ queryKey: ['sales', 'tickets', 'history'] });
          }}
          onVoid={async (id) => {
            await voidTicket(id);
            void queryClient.invalidateQueries({ queryKey: ['sales', 'tickets', 'history'] });
          }}
```

`hydrateTickets` del POS **no se toca**.

- [ ] **Step 7: Verificar**

Run:

```bash
npm --prefix apps/api test
npm --prefix apps/api run test:db
npm --prefix apps/web-admin test
npx tsc --noEmit -p apps/web-admin
npm --prefix apps/web-admin run build
```

Expected: todo verde.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/sales/sales.service.ts apps/api/test/db/tickets-cursor.test.ts apps/web-admin/src/app/api/cursor-page.ts apps/web-admin/src/app/api/cursor-page.test.ts apps/web-admin/src/app/api/client.ts apps/web-admin/src/features/sales/pos/HistoryModule.tsx apps/web-admin/src/features/sales/pos/VentasPosContext.tsx
git commit -m "feat(admin): historial de tickets pagina con cursor"
```

---

### Task 7: Runbook y cierre

**Files:**
- Modify: `docs/RUNBOOK.md`

**Interfaces:**
- Consumes: comportamiento de Tasks 1–6.
- Produces: nada de código.

- [ ] **Step 1: Agregar una sección corta al runbook**

Al final de `docs/RUNBOOK.md` (o bajo la sección de React Query del admin, si existe), agregar:

```md
## POS, roles y listados (2026-09-10)

- El rol **Vendedor** y **Gerente_Ventas** pueden `GET /stock/products` (y almacenes/categorías) para calcular stock vendible. No pueden mutar inventario ni ver proveedores/OC/movimientos.
- El admin no dispara esas queries de inventario admin si el rol no entra al módulo Inventario — evita un 403 con toast al loguear un vendedor.
- `PUT /settings/config` manda `version` cuando el front ya leyó la fila. Un 409 significa que otro operador guardó la misma clave: recargar.
- Ventas → Reportes → Historial pide páginas de 50 tickets (`?limit=50&cursor=`). El mostrador sigue hidratando los últimos 100 sin cursor, para el dashboard del día.
```

- [ ] **Step 2: Grep de control**

Desde la raíz del repo:

```bash
rg "STOCK_POS_READ_ROLES" apps/api/src
rg "canQueryStockCatalog" apps/web-admin/src
rg "buildUpsertPayload" apps/web-admin/src
rg "listPage" apps/web-admin/src
rg "useLocalStorage" apps/web-admin/src/features/kitchen/use-kitchen-state.ts
```

Expected: los cuatro primeros matchean; el de kitchen **no** matchea.

- [ ] **Step 3: Suites finales**

```bash
npm --prefix apps/api test
npm --prefix apps/api run test:db
npm --prefix apps/web-admin test
npm --prefix apps/web-admin run build
npm --prefix apps/api run build
```

Expected: verde.

- [ ] **Step 4: Verificación en navegador (obligatoria, no opcional)**

Login `vendedor` / la password demo del seed. Abrir Ventas → Mostrador:

1. El picker **muestra productos** (no vacío).
2. No aparece toast de 403 al cargar.
3. Una venta de un ítem con receta descuenta stock (el 409 en inglés ya no existe; el de stock insuficiente sigue en español).

Login admin. Ventas → Reportes → Historial:

4. Si hay más de 50 tickets, aparece **Cargar más** y trae otra página sin repetir números.
5. Cambiar un setting de fútbol (notificaciones) con dos pestañas: la segunda en 409 muestra el mensaje de recargar.

- [ ] **Step 5: Commit**

```bash
git add docs/RUNBOOK.md
git commit -m "docs: POS lee insumos, config versionada e historial paginado"
```

Si el Step 4 encontró un bug y se arregló en esta task, incluir esos archivos en el mismo commit o en uno `fix:` aparte — no dejar el runbook mintiendo.
