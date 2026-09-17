# Limpieza de tests + carrera de rol en Ventas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el lote bounded que quedó de la red de seguridad de tests: la carrera de rol/URL en Ventas, el testid del modal de Mesas, el hook SSE muerto, higiene de CI/Vitest/RUNBOOK, y aserciones e2e que hoy no pueden fallar.

**Architecture:** No hay módulo nuevo. La carrera se corrige en `AuthenticatedApp` sincronizando `initialUser` (sesión real de `App.tsx`) hacia `stock-current-user` *durante el render* — patrón de React “adjusting state when a prop changes” — para que `SalesModule` / `FutbolModule` / `OnlineModule` nunca vean el default `Vendedor` ni un rol de una sesión anterior. El resto son deletes, locators y config.

**Tech Stack:** React 18 + Vite (web-admin), Vitest 3.2, Playwright 1.55, GitHub Actions.

**Spec:** No hay spec aparte. Alcance cerrado en la conversación del 2026-09-17 sobre leftovers de `docs/superpowers/plans/2026-09-11-red-seguridad-tests.md`. El diagnóstico de la carrera (no “localStorage asíncrono”) es parte de este plan.

## Global Constraints

- Este plan **no** explora ni cambia fútbol (fixture/canchas) ni Stock/POS más allá de Mesas/Ventas ya citados. Esos frentes necesitan otro discovery.
- No revivir automatización de fixture/horarios. No tocar Prisma (`CapitanAutorizado` / `InscripcionJugador` / `CuentaEquipo`).
- No agregar `@testing-library/react`. web-admin no lo usa; la lógica de sync se testea en Vitest puro y la carrera se prueba en e2e.
- No “arreglar” la carrera retrasando el `useEffect` de `SalesModule.tsx`. El hijo no tiene que adivinar; el padre no debe pasar un rol viejo.
- `Vendedor` no puede tab `mesas`; `Gerente_Ventas` sí (`VENTAS_TABS` en `permissions.ts`). El default de `usePlatformState` es `{ username: '', role: 'Vendedor' }`.
- Comparar sesión vs persistido por **campos** (`id`, `role`, `username`), no por identidad de objeto: `initialUser` es estable en `App.tsx` pero un `===` contra un objeto re-creado re-entraría.
- Commits por tarea, mensajes al estilo del repo (`fix(admin): …`, `test(e2e): …`, `ci: …`, `docs: …`).
- Orden obligatorio: Tarea 1 → 2 → 3 → 4 → 5 → 6. La 2 y la 5 editan el mismo spec que la 1; la 5 endurece fútbol/mesas y **falla si la 1 no está**.

## Fuera de alcance (no implementar)

- Gaps de fútbol manual o de Stock/POS (otro plan, después de explorar).
- Rama `claude/team-captain-admin-web-112189`.
- Gemelo `useKitchenApiAdapter` en `apps/web-public/src/app/api/adapters.ts` (mismo patrón muerto; no inflar este lote).
- `useMediaApiAdapter` / `useSponsorsApiAdapter` aunque tampoco tengan callers.

---

## File structure

| File | Responsibility |
|------|----------------|
| Create: `apps/web-admin/src/app/sync-session-user.ts` | Predicado puro: ¿el usuario persistido está stale respecto de la sesión? |
| Create: `apps/web-admin/src/app/sync-session-user.test.ts` | Vitest del predicado (la decisión de cuándo pisar estado). |
| Modify: `apps/web-admin/src/app/AuthenticatedApp.tsx` | Dejar de sincronizar en `useEffect`; ajustar estado en el render y pasar al context el usuario de sesión. |
| Modify: `apps/web-admin/src/features/sales/pos/TablesModule.tsx` | `data-testid="lch-mesas-modal-agregar"` en el overlay “Agregar producto”. |
| Modify: `apps/web-admin/src/app/api/adapters.ts` | Borrar `useKitchenApiAdapter` entero (nadie lo importa; el SSE nativo no manda Bearer). |
| Modify: `apps/web-admin/src/app/api/adapters.fallback.test.ts` | Aserción de que el hook ya no se exporta. |
| Modify: `apps/web-admin/src/features/online/panels/CocinaOnlinePanel.tsx` | Comentario: ya no apuntar a un hook muerto. |
| Modify: `e2e/fixtures/ids.ts` | `mesasModalAgregar: 'lch-mesas-modal-agregar'`. |
| Modify: `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts` | Deep-link `?tab=mesas`, locator por testid, devolución del producto recién vendido. |
| Modify: `e2e/tests/public/pedidos-qr.spec.ts` | Headings reales, no regex tautológico sobre `<body>`. |
| Modify: `e2e/tests/admin/inventario.spec.ts` | Columna Proveedor, no `/Pedido\|Proveedor\|…/` que matchea el h1. |
| Modify: `e2e/tests/admin/futbol.spec.ts` | Headings `Equipos` / `Fixture`. |
| Modify: `e2e/playwright.config.ts` | `forbidOnly: !!process.env.CI`. |
| Modify: `e2e/fixtures/auth.ts` | Sacar `{ timeout: 45_000 }` redundante con el timeout del test. |
| Modify: `.github/workflows/test.yml` | Filtro de branch + `concurrency`. |
| Modify: `apps/api/vitest.config.ts`, `apps/web-admin/vitest.config.ts`, `apps/web-public/vitest.config.ts` | `coverage.exclude` extiende `configDefaults.coverage.exclude`. |
| Modify: `docs/RUNBOOK.md` | `test:e2e` necesita `dev:infra`; `test:ci` corta en el primer `&&`; adapter KDS ya no existe. |

`SalesModule.tsx` **no se toca**. El efecto de `tab` está bien una vez que `currentUser.role` es el de la sesión en el primer commit de React.

---

### Task 1: Sincronizar usuario de sesión durante el render

**Files:**
- Create: `apps/web-admin/src/app/sync-session-user.ts`
- Create: `apps/web-admin/src/app/sync-session-user.test.ts`
- Modify: `apps/web-admin/src/app/AuthenticatedApp.tsx:18-20`
- Modify: `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts:11-17`

**Interfaces:**
- Consumes: `CurrentUser` (`id?: string; username: string; role: UserRole`) de `@/features/platform/types`.
- Produces: `persistedUserIsStale(persisted: CurrentUser, session: CurrentUser): boolean`. `AuthenticatedApp` llama a `setCurrentUser(initialUser)` durante el render si da `true`, y el `AppContext.Provider` recibe `currentUser: initialUser` en ese mismo render. Tarea 2 y 5 asumen que `GET /#/ventas?tab=mesas` con `.auth/gerente.json` deja `tab=mesas` y monta `TablesModule`.

**Por qué falla hoy**

Dos stores distintos:

1. `lch-auth-user` — sesión de `App.tsx` → prop `initialUser`.
2. `stock-current-user` — `useLocalStorage` en `usePlatformState`, default `{ username: '', role: 'Vendedor' }`.

`AuthenticatedApp` hoy hace:

```tsx
useEffect(() => {
  setCurrentUser(initialUser);
}, [initialUser, setCurrentUser]);
```

Eso corre **después** del primer commit. `SalesModule` en ese primer commit ve `Vendedor` (o el rol de otra sesión), `canAccessVentasTab('Vendedor', 'mesas')` es `false`, `getDefaultVentasTab` devuelve `'mostrador'`, y el efecto de URL escribe `tab=mostrador`. Cuando el rol se corrige, el deep-link ya se perdió.

El e2e de mesas documenta el workaround: no ir a `?tab=mesas`, ir a `/ventas` y clickear “Mesas”.

- [ ] **Step 1: Test que falla del predicado**

Crear `apps/web-admin/src/app/sync-session-user.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { persistedUserIsStale } from './sync-session-user';
import type { CurrentUser } from '@/features/platform/types';

const vendedor: CurrentUser = { id: 'u-v', username: 'vendedor', role: 'Vendedor' };
const gerente: CurrentUser = { id: 'u-g', username: 'gerente', role: 'Gerente_Ventas' };
const emptyDefault: CurrentUser = { username: '', role: 'Vendedor' };

describe('persistedUserIsStale', () => {
  it('es true cuando el persistido es el default vacío y la sesión es gerente', () => {
    expect(persistedUserIsStale(emptyDefault, gerente)).toBe(true);
  });

  it('es true cuando el persistido es Vendedor y la sesión es Gerente_Ventas', () => {
    expect(persistedUserIsStale(vendedor, gerente)).toBe(true);
  });

  it('es true si cambia solo el id', () => {
    expect(
      persistedUserIsStale(
        { id: 'a', username: 'gerente', role: 'Gerente_Ventas' },
        { id: 'b', username: 'gerente', role: 'Gerente_Ventas' },
      ),
    ).toBe(true);
  });

  it('es false cuando id, role y username coinciden', () => {
    expect(persistedUserIsStale(gerente, { ...gerente })).toBe(false);
  });
});
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run:

```bash
npm run test --workspace=apps/web-admin -- src/app/sync-session-user.test.ts
```

Expected: FAIL con `Failed to resolve import "./sync-session-user"` o `persistedUserIsStale is not a function`.

- [ ] **Step 3: Implementar el predicado**

Crear `apps/web-admin/src/app/sync-session-user.ts`:

```ts
import type { CurrentUser } from '@/features/platform/types';

export function persistedUserIsStale(
  persisted: CurrentUser,
  session: CurrentUser,
): boolean {
  return (
    persisted.id !== session.id ||
    persisted.role !== session.role ||
    persisted.username !== session.username
  );
}
```

- [ ] **Step 4: Correr el test del predicado**

Run:

```bash
npm run test --workspace=apps/web-admin -- src/app/sync-session-user.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Convertir el e2e de mesas en el test de la carrera**

En `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts` reemplazar el bloque de navegación (líneas 11-17 hoy) por deep-link. Dejar el resto del spec igual (el locator estructural del modal lo cambia la Tarea 2).

Queda así la cabecera del test:

```ts
test('mesa cobrada habilita devolución y registra consumo', async ({ page }) => {
  const mesaName = `e2e-mesa-${Date.now()}`;
  // Deep-link deliberado: si AuthenticatedApp sincroniza el rol en un effect
  // posterior al primer render, SalesModule reescribe a tab=mostrador y este
  // expect falla (lch-mesas-nueva no existe en Mostrador).
  await page.goto(`${ADMIN_URL}/#/ventas?tab=mesas`);
  await expect(page).toHaveURL(/tab=mesas/);
  await expect(page.getByTestId(ids.mesasNueva)).toBeVisible();

  await page.getByTestId(ids.mesasNueva).click();
```

Borrar el comentario viejo de “navegamos a /ventas y clickeamos Mesas”.

- [ ] **Step 6: Correr el e2e de mesas y verlo fallar (carrera todavía viva)**

Hace falta infra local (`npm run dev:infra`) si Postgres/Redis/MinIO no están up. Puertos e2e: API 3002, admin 5175, pública 5176 — no 3001/5173/5174.

Run:

```bash
npm run test:e2e -- tests/admin/pos-mesa-devolucion-consumo.spec.ts
```

Expected: FAIL. Típico: `toHaveURL(/tab=mesas/)` termina en `tab=mostrador`, o `getByTestId('lch-mesas-nueva')` timeout. Si este spec **pasa** sin tocar `AuthenticatedApp`, parar y re-diagnosticar: no seguir con el setState durante el render “por las dudas”.

- [ ] **Step 7: Sincronizar durante el render en `AuthenticatedApp`**

Reemplazar el cuerpo de `AuthenticatedApp` (hoy `useEffect` + `setCurrentUser(initialUser)`) por esto. El effect de backfill de movimientos **no se toca**.

```tsx
import { useRef } from 'react';
import { AppContext } from '@/app/providers/AppContext';
import { useAppState } from '@/app/providers/use-app-state';
import { LogoutContext, router, RouterProvider } from '@/app/router';
import type { CurrentUser } from '@/features/platform/types';
import { buildBackfillMovements } from '@/features/inventory/backfill-movements';
import { persistedUserIsStale } from '@/app/sync-session-user';

type AuthenticatedAppProps = {
  initialUser: CurrentUser;
  onLogout: () => void;
};

export default function AuthenticatedApp({ initialUser, onLogout }: AuthenticatedAppProps) {
  const appState = useAppState();
  const { currentUser, setCurrentUser } = appState;
  const backfilledRef = useRef(false);

  // Patrón React: ajustar estado durante el render cuando la prop de sesión
  // no coincide con lo persistido. React descarta este render y reintenta
  // con el state nuevo; el override del context cubre este render por si
  // algún hijo se evaluara antes del reintento.
  if (persistedUserIsStale(currentUser, initialUser)) {
    setCurrentUser(initialUser);
  }

  const contextValue = persistedUserIsStale(currentUser, initialUser)
    ? { ...appState, currentUser: initialUser }
    : appState;

  // Reconstruye el libro de movimientos desde el historial existente (una sola vez).
  // (dejar el useEffect de backfill exactamente como está hoy)

  return (
    <LogoutContext.Provider value={onLogout}>
      <AppContext.Provider value={contextValue}>
        <RouterProvider router={router} />
      </AppContext.Provider>
    </LogoutContext.Provider>
  );
}
```

Quitar `useEffect` del import si ya no se usa fuera del backfill — el backfill **sí** usa `useEffect`; el import queda `import { useEffect, useRef } from 'react'`.

No compares `currentUser === initialUser`. No dejes el `useEffect` de sync “por compatibilidad”: volvería a escribir después y no aporta.

- [ ] **Step 8: Re-correr predicado + e2e de mesas**

Run:

```bash
npm run test --workspace=apps/web-admin -- src/app/sync-session-user.test.ts
npm run test:e2e -- tests/admin/pos-mesa-devolucion-consumo.spec.ts
```

Expected: PASS. El spec llega a Mesas por URL, cobra, devuelve y registra consumo como antes.

- [ ] **Step 9: Commit**

```bash
git add apps/web-admin/src/app/sync-session-user.ts apps/web-admin/src/app/sync-session-user.test.ts apps/web-admin/src/app/AuthenticatedApp.tsx e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts
git commit -m "fix(admin): sincronizar rol de sesión antes del primer render de Ventas."
```

---

### Task 2: `data-testid` del modal “Agregar producto” en Mesas

**Files:**
- Modify: `apps/web-admin/src/features/sales/pos/TablesModule.tsx:252-277`
- Modify: `e2e/fixtures/ids.ts:9-13`
- Modify: `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts` (el bloque del modal; post-Tarea 1 ya navega con `?tab=mesas`)

**Interfaces:**
- Consumes: deep-link a Mesas de la Tarea 1; `ids.mesasAgregar` ya existe (`lch-mesas-agregar`).
- Produces: `ids.mesasModalAgregar === 'lch-mesas-modal-agregar'` en el overlay del modal de productos (no el de “Abrir cuenta de equipo”). El spec deja de usar `.fixed.inset-0.z-50`.

- [ ] **Step 1: Extender el mapa de testids (el spec va a fallar en el siguiente paso, no este)**

En `e2e/fixtures/ids.ts`, junto a los ids de mesas existentes:

```ts
  mesasNueva: 'lch-mesas-nueva',
  mesasNombre: 'lch-mesas-nombre',
  mesasCrear: 'lch-mesas-crear',
  mesasAgregar: 'lch-mesas-agregar',
  mesasModalAgregar: 'lch-mesas-modal-agregar',
  mesasCobrar: 'lch-mesas-cobrar',
```

- [ ] **Step 2: Apuntar el spec al testid nuevo**

En `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts`, reemplazar el bloque que hoy es:

```ts
  await page.getByTestId(ids.mesasAgregar).click();
  // El modal de "Agregar producto" de la mesa no reusa el picker del POS
  // (no tiene lch-pos-product): es una grilla propia de TablesModule, cuyos
  // botones de producto se distinguen del botón de cerrar (ícono X sin
  // contenido) por tener el emoji dentro de un div.text-2xl.
  const addProductModal = page.locator('.fixed.inset-0.z-50');
  await addProductModal
    .locator('button')
    .filter({ has: page.locator('div.text-2xl') })
    .first()
    .click();
  await addProductModal.locator('svg.lucide-x').click();
```

por:

```ts
  await page.getByTestId(ids.mesasAgregar).click();
  const addProductModal = page.getByTestId(ids.mesasModalAgregar);
  await expect(addProductModal).toBeVisible();
  await addProductModal
    .locator('button')
    .filter({ has: page.locator('div.text-2xl') })
    .first()
    .click();
  await addProductModal.locator('svg.lucide-x').click();
```

No agregues `lch-pos-product` a esta grilla: el picker del mostrador y el de mesas no son el mismo componente.

- [ ] **Step 3: Correr el spec y ver fallar el testid**

Run:

```bash
npm run test:e2e -- tests/admin/pos-mesa-devolucion-consumo.spec.ts
```

Expected: FAIL con `getByTestId('lch-mesas-modal-agregar')` not found (el modal existe, pero sin el atributo).

- [ ] **Step 4: Poner el testid en el overlay del modal de productos**

En `TablesModule.tsx`, el modal de `showAddProduct` (el que dice `Agregar a {current.team}`, **no** el de `showNew` / “Abrir cuenta de equipo”) queda:

```tsx
      {showAddProduct && current && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-4"
          data-testid="lch-mesas-modal-agregar"
        >
          <div className="bg-card rounded-xl p-4 w-full max-w-md max-h-[80vh] flex flex-col">
```

El `data-testid` va en el overlay (`fixed inset-0`), no en la card interior: así el click del X sigue siendo `addProductModal.locator('svg.lucide-x')`.

- [ ] **Step 5: Re-correr el spec**

Run:

```bash
npm run test:e2e -- tests/admin/pos-mesa-devolucion-consumo.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/features/sales/pos/TablesModule.tsx e2e/fixtures/ids.ts e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts
git commit -m "test(e2e): testid del modal agregar producto en Mesas."
```

---

### Task 3: Borrar `useKitchenApiAdapter` (SSE nativo muerto)

**Files:**
- Modify: `apps/web-admin/src/app/api/adapters.ts:7-16` (imports) y borrar el bloque `// ==================== Kitchen Adapter ====================` (hoy ~301-366)
- Modify: `apps/web-admin/src/app/api/adapters.fallback.test.ts`
- Modify: `apps/web-admin/src/features/online/panels/CocinaOnlinePanel.tsx:63-73`
- Modify: `docs/RUNBOOK.md:325-329`

**Interfaces:**
- Consumes: nada. El único KDS vivo es `CocinaOnlinePanel`, que hace `fetch` a `GET /sse/events` con `Authorization` porque `EventSource` no manda headers.
- Produces: `adapters.ts` deja de exportar `useKitchenApiAdapter`. `kitchenApi` y `KitchenOrderStatus` salen de los imports de ese archivo. Tarea 4 no depende de esto.

Confirmado en el repo: cero imports de `useKitchenApiAdapter` fuera de `adapters.ts` y un comentario en el panel. `useSalesApiAdapter` / `usePrintingApiAdapter` **sí** se usan; no borrarlos.

- [ ] **Step 1: Test que falla — el hook no debe exportarse**

En `apps/web-admin/src/app/api/adapters.fallback.test.ts` agregar:

```ts
  it('no exporta useKitchenApiAdapter (KDS usa fetch+Bearer en CocinaOnlinePanel)', () => {
    expect('useKitchenApiAdapter' in adapters).toBe(false);
  });
```

dejar el test existente de `shouldAllowLocalFallback`.

- [ ] **Step 2: Correr y ver FAIL**

Run:

```bash
npm run test --workspace=apps/web-admin -- src/app/api/adapters.fallback.test.ts
```

Expected: FAIL, `expected true to be false` (la clave sigue en el módulo).

- [ ] **Step 3: Borrar el hook y limpiar imports**

En `adapters.ts`:

1. Imports de valor: `salesApi, kitchenApi, mediaApi, sponsorsApi, printingApi` → `salesApi, mediaApi, sponsorsApi, printingApi`.
2. Imports de tipo: sacar `KitchenOrderStatus`.
3. Borrar desde `// ==================== Kitchen Adapter ====================` inclusive hasta justo antes de `// ==================== Media Adapter ====================` (la función `useKitchenApiAdapter` completa, ~65 líneas).

No dejes un stub. No migres el hook a `fetch`: eso ya está en `CocinaOnlinePanel`.

- [ ] **Step 4: Actualizar el comentario del panel**

En `CocinaOnlinePanel.tsx`, el bloque de comentario del SSE (líneas 63-73) reemplazarlo por:

```tsx
  // Empuje en tiempo real vía SSE (GET /sse/events, LISTEN/NOTIFY del lado API).
  // No usamos el `EventSource` nativo del browser porque no permite mandar
  // headers propios y esta ruta exige `Authorization: Bearer <token>` (RBAC);
  // en su lugar leemos el body como stream con `fetch`, que sí acepta headers.
  // El polling de 15s de arriba queda como red de contención si esta conexión
  // se cae (proxy que bufferea, token vencido, etc.) o mientras se reconecta.
  //
  // `kitchenId` va como query param para que `SseService.deliverLocally`
  // filtre del lado del server: sin esto, este panel recibía eventos de
  // *todas* las cocinas, no sólo la seleccionada.
```

- [ ] **Step 5: Actualizar RUNBOOK de adapters**

En `docs/RUNBOOK.md`, sección “Frontend API Adapters” / “Available adapters”, borrar la viñeta:

```
- `useKitchenApiAdapter(kitchenId?)` - orders list, transitions, SSE
```

Dejar `useSalesApiAdapter`, `useMediaApiAdapter`, `useSponsorsApiAdapter`. (Esos dos últimos pueden estar sin callers; no es esta tarea.)

- [ ] **Step 6: Re-correr el test**

Run:

```bash
npm run test --workspace=apps/web-admin -- src/app/api/adapters.fallback.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add apps/web-admin/src/app/api/adapters.ts apps/web-admin/src/app/api/adapters.fallback.test.ts apps/web-admin/src/features/online/panels/CocinaOnlinePanel.tsx docs/RUNBOOK.md
git commit -m "chore(admin): borrar useKitchenApiAdapter; el KDS ya usa fetch con Bearer."
```

---

### Task 4: Higiene CI, coverage de Vitest, timeout de login, RUNBOOK

**Files:**
- Modify: `.github/workflows/test.yml`
- Modify: `e2e/playwright.config.ts`
- Modify: `e2e/fixtures/auth.ts:21-40`
- Modify: `apps/api/vitest.config.ts`
- Modify: `apps/web-admin/vitest.config.ts`
- Modify: `apps/web-public/vitest.config.ts`
- Modify: `docs/RUNBOOK.md:438-444`

**Interfaces:**
- Consumes: scripts ya existentes `test` / `test:db` / `test:e2e` / `test:ci` (`test:ci` es `npm test && npm run test:db && npm run test:e2e`).
- Produces: Actions no corre dos veces por cada push a rama de PR; un `test.only` en CI aborta; `coverage.exclude` no pisa los defaults de Vitest; login e2e usa `expect.timeout` global (15s); RUNBOOK dice que e2e local necesita `dev:infra` y que `test:ci` no sigue si `npm test` falla.

No hay test unitario útil para YAML. La verificación es: Vitest sigue pasando umbrales, Playwright carga el config.

- [ ] **Step 1: Filtro de branch + concurrency en Actions**

Reemplazar el encabezado de `.github/workflows/test.yml` (hoy `on: push` + `pull_request` sin filtro y sin concurrency) por:

```yaml
name: test
on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
```

No tocar los jobs `unit` / `integrity` ni sus steps. `pull_request` sin filtro de branch cubre PRs hacia main. Un push a `feat/…` ya no dispara el workflow dos veces (push + PR).

- [ ] **Step 2: `forbidOnly` en Playwright**

En `e2e/playwright.config.ts`, dentro de `defineConfig({...})`, al mismo nivel que `fullyParallel` / `workers` / `timeout`, agregar:

```ts
  forbidOnly: !!process.env.CI,
```

`CI: true` ya lo setea el job `integrity` en el step `npm run test:e2e`. Local sigue permitiendo `test.only`.

- [ ] **Step 3: Sacar el timeout interno de 45s en login**

`e2e/playwright.config.ts` ya tiene `timeout: 45_000` (test) y `expect: { timeout: 15_000 }`. `loginAdmin` / `loginPublic` pisan expect a 45s; es redundante con el techo del test y más holgado que el expect global. En `e2e/fixtures/auth.ts`:

```ts
  await expect(page.getByTestId(ids.loginSubmit)).toHaveCount(0);
```

y lo mismo en `loginPublic`. **No** pongas `{ timeout: 45_000 }` de nuevo. `auth.setup.ts` ya hace `setup.setTimeout(240_000)` para las 7 sesiones: el techo del setup sigue siendo 240s; cada expect de login espera 15s. Si CI flakea por login lento, subir `expect.timeout` en `playwright.config.ts`, no reponer el override en el fixture.

- [ ] **Step 4: `coverage.exclude` extiende defaults**

Los tres configs hoy **reemplazan** la lista. Vitest 3 exporta `configDefaults.coverage.exclude` (node_modules, dist, `*.d.ts`, tests, etc.).

`apps/api/vitest.config.ts` ya importa `configDefaults`. Cambiar solo `coverage.exclude`:

```ts
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'test/**',
        'dist/**',
        'prisma/**',
        'scripts/**',
      ],
```

`apps/web-admin/vitest.config.ts` — agregar `configDefaults` al import:

```ts
import { defineConfig, configDefaults } from 'vitest/config'
```

y:

```ts
      exclude: [
        ...(configDefaults.coverage.exclude ?? []),
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
      ],
```

`apps/web-public/vitest.config.ts` — igual que web-admin (mismo import + mismo `exclude`).

No bajes ni subas `thresholds`. Si coverage cae por incluir archivos que antes se excluían mal, el test de coverage **debe** fallar: en ese caso agregá el glob concreto del archivo de ruido (no bajes el umbral).

- [ ] **Step 5: RUNBOOK de tests**

Reemplazar el bloque de `docs/RUNBOOK.md` líneas 438-444 por:

```markdown
## Tests

- `npm test` — Vitest + coverage (sin browser, sin Postgres).
- `npm run test:db` — constraints en `lch_stock_test` (requiere `npm run dev:infra`: Postgres, Redis, MinIO).
- `npm run test:e2e` — reset de `lch_stock_test` + API :3002 + admin :5175 + pública :5176 + Chromium.
  También requiere `npm run dev:infra` (el `webServer` de Playwright no levanta Docker; habla con Postgres/Redis/MinIO ya arriba).
  No uses 3001/5173/5174. Si un puerto e2e está ocupado, cerrá el e2e anterior.
- `npm run test:ci` — `npm test && npm run test:db && npm run test:e2e`. Cortocircuita: si Vitest falla, no corre db ni Playwright. Es atajo local; Actions parte `unit` / `integrity` en jobs distintos.
```

- [ ] **Step 6: Verificar Vitest (umbrales) y que Playwright parsea el config**

Run:

```bash
npm test
npx --workspace=@lch/e2e playwright test --list
```

Expected: `npm test` PASS (mismos umbrales). `--list` imprime los specs sin error de config. No hace falta la suite e2e completa acá (Tarea 6).

- [ ] **Step 7: Commit**

```bash
git add .github/workflows/test.yml e2e/playwright.config.ts e2e/fixtures/auth.ts apps/api/vitest.config.ts apps/web-admin/vitest.config.ts apps/web-public/vitest.config.ts docs/RUNBOOK.md
git commit -m "ci: concurrency, forbidOnly y coverage.exclude sobre defaults de Vitest."
```

---

### Task 5: Aserciones e2e que puedan fallar de verdad

**Files:**
- Modify: `e2e/tests/public/pedidos-qr.spec.ts:20-24`
- Modify: `e2e/tests/admin/inventario.spec.ts:14-16`
- Modify: `e2e/tests/admin/futbol.spec.ts:10-15`
- Modify: `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts` (selección de producto a devolver; post-Tarea 2 el modal ya usa testid)

**Interfaces:**
- Consumes: Tarea 1 (deep-link fútbol/mesas ya no pisa el tab). Headings reales: pública `Mis Pedidos` / `Tu código de retiro está listo`; admin `Equipos` / `Fixture` vía `FutbolPanelShell`; inventario columna `Proveedor` en la tabla desktop (`OrdersPage.tsx` thead).
- Produces: specs que fallan si montaron el layout pero no el panel pedido. Devolución clickea el producto recién agregado a la mesa, no `.first()` de “Pendiente de devolver”.

**Por qué las regex actuales no fallan**

- `pedidos-qr`: `/pedido|retiro|qr|#/i` matchea nav “Pedidos”, “No hay pedido activo con codigo QR”, el hash `#/qr`, casi cualquier shell.
- `inventario`: `/Pedido|Proveedor|Borrador|Recibido/i` matchea el h1 `Pedidos` que el spec **ya** asertó dos líneas arriba.
- `futbol`: `/equipo/i` matchea el botón de tab “Equipos” del sidebar aunque el panel sea Inicio (síntoma de la misma carrera de rol).
- `pos-mesa` línea del `.first()` sobre `/Pendiente de devolver/`: si el seed o un ticket previo dejó otro vendible, el spec no devuelve lo que cobró en la mesa.

- [ ] **Step 1: Endurecer `pedidos-qr.spec.ts`**

Reemplazar las dos aserciones de `body` por headings de `OrdersPage` y `QrPage`. Después del pago, `PaymentPage` hace `navigate('/qr')` (sin `orderId`; el QR vive de `lastOrder` en el cart). El hash `/#/pedidos` y `/#/qr` no remonta la app, así que `lastOrder` sigue ahí.

```ts
  await page.goto(`${PUBLIC_URL}/#/pedidos`);
  await expect(page.getByRole('heading', { name: 'Mis Pedidos' })).toBeVisible();

  await page.goto(`${PUBLIC_URL}/#/qr`);
  await expect(page.getByRole('heading', { name: 'Tu código de retiro está listo' })).toBeVisible();
```

El `toHaveURL(/qr/)` posterior al pagar se queda.

- [ ] **Step 2: Endurecer `inventario.spec.ts`**

El h1 `Pedidos` ya está. Cambiar el `body` regex por la columna que solo existe en la tabla de OC:

```ts
  await page.goto(`${ADMIN_URL}/#/pedidos`);
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Proveedor' })).toBeVisible();
```

Playwright e2e usa `Desktop Chrome` (`playwright.config.ts` `devices['Desktop Chrome']`); la tabla no está en `hidden sm:block` para ese viewport. No uses `/Borrador/` — ese string no está en la lista (estados: Pendiente / Recibido).

- [ ] **Step 3: Endurecer `futbol.spec.ts`**

```ts
test('equipos y fixture', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/futbol?tab=equipos`);
  await expect(page).toHaveURL(/tab=equipos/);
  await expect(page.getByRole('heading', { name: 'Equipos' })).toBeVisible();

  await page.goto(`${ADMIN_URL}/#/futbol?tab=fixture`);
  await expect(page).toHaveURL(/tab=fixture/);
  await expect(page.getByRole('heading', { name: 'Fixture' })).toBeVisible();
});
```

`getByRole('heading', { name: 'Equipos' })` es el `h1` de `FutbolPanelShell`, no el botón de tab. Si la Tarea 1 no está, este spec falla con URL `tab=inicio` o heading “Torneo” — eso es deseable.

- [ ] **Step 4: Devolver el producto de la mesa, no el primero de la lista**

En `pos-mesa-devolucion-consumo.spec.ts`, al elegir producto del modal, capturar el nombre **antes** del click (el modal se cierra después). El bloque post-Tarea 2 queda:

```ts
  await page.getByTestId(ids.mesasAgregar).click();
  const addProductModal = page.getByTestId(ids.mesasModalAgregar);
  await expect(addProductModal).toBeVisible();
  const productBtn = addProductModal
    .locator('button')
    .filter({ has: page.locator('div.text-2xl') })
    .first();
  const productName = (await productBtn.locator('.text-sm.text-foreground').innerText()).trim();
  await productBtn.click();
  await addProductModal.locator('svg.lucide-x').click();
```

Más abajo, en Devoluciones, reemplazar:

```ts
  await page.getByRole('button', { name: /Pendiente de devolver/ }).first().click();
```

por:

```ts
  await page.getByRole('button', { name: new RegExp(productName) }).click();
```

`productName` sale del catálogo de cantina (seed); no interpolar `mesaName` ahí — el botón de devolución muestra el **producto**, no el equipo. Si `productName` tuviera regex metacharacters raros, `new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))`. Los nombres del seed actual no los necesitan; escapá igual para no acoplar el spec al catálogo.

- [ ] **Step 5: Correr los 4 specs**

Run:

```bash
npm run test:e2e -- tests/public/pedidos-qr.spec.ts tests/admin/inventario.spec.ts tests/admin/futbol.spec.ts tests/admin/pos-mesa-devolucion-consumo.spec.ts
```

Expected: PASS. Si `Tu código de retiro está listo` no aparece al volver a `/#/qr`, el cart perdió `lastOrder`: no aflojes a un regex de body; arreglá la navegación del spec para reusar `orderId` (p.ej. leerlo de `/#/pedidos` clickeando el pedido). No es el caso esperado con hash routing.

- [ ] **Step 6: Commit**

```bash
git add e2e/tests/public/pedidos-qr.spec.ts e2e/tests/admin/inventario.spec.ts e2e/tests/admin/futbol.spec.ts e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts
git commit -m "test(e2e): aserciones de pantalla real en pedidos, inventario, fútbol y mesas."
```

---

### Task 6: Suite completa

**Files:**
- Ninguno nuevo. Verificación de las tareas 1-5 juntas.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: evidencia de `npm test`, `npm run test:db` y `npm run test:e2e` en verde (o `npm run test:ci` equivalente) antes de declarar el lote cerrado.

- [ ] **Step 1: Infra**

Si Docker no está: levantar Desktop y `npm run dev:infra`. Postgres 5432, Redis 6379, MinIO 9000 tienen que responder. Sin eso `test:db` y `test:e2e` fallan con ECONNREFUSED, no con un bug de este plan.

- [ ] **Step 2: Unit + coverage**

Run:

```bash
npm test
```

Expected: PASS. Umbrales de coverage iguales a los que ya están en los tres `vitest.config.ts`.

- [ ] **Step 3: Constraints de DB**

Run:

```bash
npm run test:db
```

Expected: PASS. Este plan no toca Prisma; si falla es ambiente, no una tarea anterior.

- [ ] **Step 4: Playwright completo**

Run:

```bash
npm run test:e2e
```

Expected: PASS. Specs sensibles a este lote: `pos-mesa-devolucion-consumo`, `pos-mostrador` (sigue yendo a `?tab=mostrador`, que `Vendedor` sí puede), `futbol`, `inventario`, `pedidos-qr`, `login-rbac`.

- [ ] **Step 5: No hay commit vacío**

Si algún archivo quedó sucio (formateo), incluirlo en un commit `chore:` aparte. Si el working tree está limpio, no hagas commit.

---

## Self-review

**1. Spec coverage**

| Pedido | Tarea |
|--------|-------|
| Carrera de rol: sync en render, no en effect | 1 |
| Deep-link `?tab=mesas` como prueba | 1 |
| `lch-mesas-modal-agregar` + spec | 2 |
| Borrar EventSource/hook muerto `adapters.ts:337` | 3 |
| CI branch filter + concurrency + `forbidOnly` | 4 |
| `coverage.exclude` extiende defaults (3 configs) | 4 |
| RUNBOOK: e2e necesita infra; `test:ci` cortocircuita | 4 |
| Timeout 45s redundante en `auth.ts` | 4 |
| 3 specs con regex tautológico de `<body>` | 5 |
| `.first()` de “Pendiente de devolver” | 5 |
| Suite completa al final | 6 |

**2. Placeholders:** ninguno. Cada paso de código tiene el snippet a pegar.

**3. Type consistency:** `persistedUserIsStale(persisted: CurrentUser, session: CurrentUser): boolean` es el único símbolo nuevo; Tarea 1 lo define y lo usa. `ids.mesasModalAgregar` se agrega en Tarea 2 y se reusa en Tarea 5. No hay `clearLayers` vs `clearFullLayers`.
