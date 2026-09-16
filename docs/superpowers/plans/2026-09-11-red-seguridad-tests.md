# Red de seguridad (tests) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar una red que demuestre lo ya hecho: Vitest con coverage y umbrales, Playwright de todos los flujos web (admin + pública + cruces, MinIO y SSE) contra `lch_stock_test`, y GitHub Actions que bloquee el PR si algo se rompe.

**Architecture:** Tres capas sin mezclarse. Vitest sigue en cada app (sin Postgres). `test:db` sigue reseteando `lch_stock_test`. Un workspace nuevo `@lch/e2e` arranca API :3002 + Vite :5175/:5176 contra esa misma base (otro reset + seeds) y corre Chromium. CI parte `unit` e `integrity` para que el unitario no espere al browser.

**Tech Stack:** Vitest 3 + `@vitest/coverage-v8`; Playwright (Chromium); NestJS 11 + Prisma 5.22 + PostgreSQL 16 + MinIO; React 18 + Vite 6. Node 20.

**Spec:** `docs/superpowers/specs/2026-09-11-red-seguridad-tests-design.md`

## Global Constraints

- `npm test` = solo Vitest + coverage. **Nunca** Playwright. `@lch/e2e` no tiene script `test`.
- Base e2e / `test:db` = `lch_stock_test`. **Nunca** tocar `lch_stock`.
- Puertos e2e: API **3002**, admin **5175**, pública **5176**. HashRouter: `http://127.0.0.1:5175/#/ventas`.
- `VITE_API_URL=http://127.0.0.1:3002` al arrancar ambos Vite. Si falta, caen a `:3001`.
- `JWT_SECRET=lch-e2e-jwt-secret-not-for-production` en el proceso de la API e2e (pisa el `.env` de demo).
- Playwright: Chromium, **1 worker**, timeout de spec **45s**, `reuseExistingServer: false`, sin `waitForTimeout` como sync, sin `test.skip`/`fixme` nuevos sin comentario+fecha.
- No Google OAuth, impresora, Electron/APK, Redis, regenerar fixture, ni partir `client.ts`.
- `data-testid` con prefijo `lch-` solo en anclas. Texto de UI en **español**.
- Commits en español, un commit por task.
- Windows + Actions (linux): scripts de harness en **Node** (`e2e/start-stack.mjs`), no PowerShell.

## Setup de rama (antes de Task 1)

```bash
git checkout feat/pos-stock-config-paginacion
git checkout -b feat/red-seguridad-tests
```

Confirmar que existen la spec y este plan. Infra local para tasks 4–9:

```bash
npm run dev:infra
```

---

## File Structure

### Nuevos

| Archivo | Responsabilidad |
|---|---|
| `e2e/package.json` | Workspace `@lch/e2e`. Script `test:e2e` solamente. |
| `e2e/playwright.config.ts` | Chromium, 1 worker, webServer → `start-stack.mjs`, globalSetup. |
| `e2e/global-setup.ts` | Reset `lch_stock_test` + `prisma:seed` + `prisma:seed:demo`. |
| `e2e/start-stack.mjs` | Health Postgres/MinIO, puertos libres, API+Vite e2e. |
| `e2e/constants.ts` | URLs, secret, `TEST_DATABASE_URL`. |
| `e2e/fixtures/ids.ts` | Constantes `data-testid`. |
| `e2e/fixtures/auth.ts` | Cuentas + `loginAdmin` / `loginPublic`. |
| `e2e/tests/auth.setup.ts` | Genera `.auth/*.json` (cwd del package `e2e/`) una vez por corrida. |
| `e2e/fixtures/files/pixel.png` | PNG 1×1 para MinIO. |
| `e2e/tests/admin/*.spec.ts` | Flujos admin. |
| `e2e/tests/public/*.spec.ts` | Flujos pública. |
| `e2e/tests/cross/*.spec.ts` | Cantina→KDS, POS→stock, pedido→admin. |
| `.github/workflows/test.yml` | Jobs `unit` e `integrity`. |
| `apps/web-admin/src/features/sales/pos/ticket-to-pos.test.ts` | Tests de `ticketToPos` + movimientos. |
| `apps/web-public/src/app/components/public/cart/checkout-items.ts` | `cartToCheckoutItems`. |
| `apps/web-public/src/app/components/public/cart/checkout-items.test.ts` | Tests del mapper carrito→API. |

### Modificados

| Archivo | Cambio |
|---|---|
| `package.json` (root) | Workspace `e2e`; scripts `test:db`, `test:e2e`, `test:ci`. |
| `apps/api/package.json` + `vitest.config.ts` | `vitest run --coverage` + umbrales. |
| `apps/web-admin/package.json` + `vitest.config.ts` | Igual. |
| `apps/web-public/package.json` + `vitest.config.ts` | Igual. |
| `.gitignore` | `coverage/`, `e2e/playwright-report/`, `e2e/test-results/`, `e2e/.auth/`. |
| `apps/web-admin/src/features/sales/pos/VentasPosContext.tsx` | Exportar `buildStockMovementsFromCart`. |
| `apps/web-public/.../PaymentPage.tsx` | Usar `cartToCheckoutItems`. |
| `apps/web-admin/.../OnlineMediaUpload.tsx` | Tras PUT, `mediaApi.confirm`. |
| Login, layout, POS, cantina, KDS, AuthForm, placeholders | `data-testid`. |
| `docs/RUNBOOK.md` | Cómo correr `test:e2e` / `test:ci`. |

### HTTP que **no** se agrega

Estos caminos ya tienen integración/BD. No inventar una suite Nest HTTP. Verificar que los archivos siguen ahí; si faltan, restaurarlos de git:

- Venta: `apps/api/test/integration/sales-stock-integrity.test.ts`
- Stock: `apps/api/test/db/stock-constraints.test.ts`, `apps/api/test/db/reconcile.test.ts`
- Cocina: `apps/api/test/unit/kitchen-transitions.test.ts` + `apps/api/test/db/public-checkout.test.ts` (crea `OrdenCocina`)
- Pedido público: `apps/api/test/db/public-checkout.test.ts`
- Write fútbol: `apps/api/test/db/fixture-berger.test.ts`

POS stock local ya está en `apps/web-admin/src/features/sales/stock-link.test.ts`. No reescribir `VentasPosContext`.

---

### Task 1: Coverage Vitest + umbrales

**Files:**
- Modify: `apps/api/package.json`, `apps/api/vitest.config.ts`
- Modify: `apps/web-admin/package.json`, `apps/web-admin/vitest.config.ts`
- Modify: `apps/web-public/package.json`, `apps/web-public/vitest.config.ts`
- Modify: `.gitignore`
- Modify: root `package.json` (solo si hace falta; `npm test` ya delega a workspaces)

**Interfaces:**
- Consumes: nada
- Produces: cada `vitest.config.ts` con `coverage.provider = 'v8'`, reporter `text`+`html`+`json-summary`, `thresholds.lines` = piso medido (entero, redondeo hacia abajo). API además:

```ts
thresholds: {
  lines: /* piso global api */,
  'src/auth/**': { lines: /* piso auth + 1, max 100 */ },
  'src/stock/**': { lines: /* piso stock + 1 */ },
  'src/sales/**': { lines: /* piso sales + 1 */ },
  'src/public/**': { lines: /* piso public + 1 */ },
}
```

`apps/api` sigue excluyendo `test/db/**` del `include` de `vitest.config.ts` (no del coverage de `test:db`).

- [ ] **Step 1: Instalar coverage y fallar sin umbral**

En cada app:

```bash
npm install -D @vitest/coverage-v8 --workspace=apps/api
npm install -D @vitest/coverage-v8 --workspace=apps/web-admin
npm install -D @vitest/coverage-v8 --workspace=apps/web-public
```

Cambiar el script `test` de cada app a:

```json
"test": "vitest run --coverage"
```

`test:deep` y `test:db` **no** llevan `--coverage`.

En `apps/api/vitest.config.ts` (el de unit, no `vitest.db.config.ts`):

```ts
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'json-summary'],
  reportsDirectory: './coverage',
  exclude: ['test/**', 'dist/**', 'prisma/**', 'scripts/**'],
  thresholds: { lines: 100 },
},
```

Lo mismo en admin/public con `exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx']` y `thresholds.lines: 100`.

- [ ] **Step 2: Correr para ver el fail de umbral**

```bash
npm run test:api
```

Expected: FAIL por coverage (100 % inalcanzable) **o** PASS si el repo ya está al 100 (improbable). Anotar el `% Lines` del summary.

Repetir `npm run test:admin` y `npm run test:public`.

- [ ] **Step 3: Clavar el piso real**

Correr de nuevo y leer `coverage/coverage-summary.json`:

```bash
node -e "const s=require('./apps/api/coverage/coverage-summary.json'); const t=s.total.lines.pct; console.log('api', Math.floor(t)); for (const [k,v] of Object.entries(s)) if (/src\\\\auth|src\\\\stock|src\\\\sales|src\\\\public/.test(k.replace(/\\\\/g,'/'))) console.log(k, Math.floor(v.lines.pct));"
```

(Si el JSON no trae globs, usar el `%` de `text` por carpeta o un segundo run con `--coverage.include=src/auth/**`.)

Poner `thresholds.lines` = `Math.floor(global)`. Críticos API = `Math.min(100, pisoCarpeta + 1)`.

Admin/public: solo piso global medido (no tienen esas carpetas de dominio API).

- [ ] **Step 4: Verificar verde + gitignore**

Agregar a `.gitignore`:

```
coverage/
e2e/playwright-report/
e2e/test-results/
e2e/.auth/
```

```bash
npm test
```

Expected: PASS. `test:db` no se corre acá.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json apps/api/vitest.config.ts apps/web-admin/package.json apps/web-admin/vitest.config.ts apps/web-public/package.json apps/web-public/vitest.config.ts package-lock.json .gitignore
git commit -m "test: coverage Vitest con umbral medido en api, admin y pública."
```

---

### Task 2: Huecos unit (POS ticket + carrito→pedido)

**Files:**
- Create: `apps/web-admin/src/features/sales/pos/ticket-to-pos.test.ts`
- Modify: `apps/web-admin/src/features/sales/pos/VentasPosContext.tsx` (export `buildStockMovementsFromCart`)
- Create: `apps/web-public/src/app/components/public/cart/checkout-items.ts`
- Create: `apps/web-public/src/app/components/public/cart/checkout-items.test.ts`
- Modify: `apps/web-public/src/app/components/public/pages/PaymentPage.tsx`

**Interfaces:**
- Consumes: `ticketToPos` ya exportada; `buildRequiredStockFromCart` en `stock-link.ts`
- Produces:

```ts
export function ticketToPos(
  ticket: SalesTicket,
  operatorName: string,
  kitchens: Kitchen[],
): PosTicket;

export function buildStockMovementsFromCart(
  cartLines: SalesCartLine[],
  salesProducts: SalesProduct[],
  type: StockMovement['type'],
  direction: 1 | -1,
  reference: string,
  operator: { id: string; name: string },
): Omit<StockMovement, 'id' | 'createdAtISO'>[];

export function cartToCheckoutItems(
  items: Array<{ id: string; qty: number }>,
): Array<{ salesProductId: string; quantity: number }>;
```

- [ ] **Step 1: Test que falla de `ticketToPos` / movimientos**

Crear `ticket-to-pos.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Kitchen, SalesProduct, SalesTicket } from '@/app/components/store';
import { buildStockMovementsFromCart, ticketToPos } from './VentasPosContext';

const kitchens: Kitchen[] = [{ id: 'k1', name: 'Parrilla', emoji: '🔥', active: true }];

function ticket(over: Partial<SalesTicket> = {}): SalesTicket {
  return {
    id: 't1',
    number: 12,
    createdAtISO: '2026-09-11T15:00:00.000Z',
    status: 'emitido',
    items: [
      { salesProductId: 'sp1', name: 'Burger', unitPrice: 1000, quantity: 2, kitchenId: 'k1' },
    ],
    total: 2000,
    operatorId: 'u1',
    operatorName: 'Ana',
    ...over,
  };
}

describe('ticketToPos', () => {
  it('marca Mostrador si la nota no es Mesa:', () => {
    const pos = ticketToPos(ticket({ note: 'Mostrador' }), 'Ana', kitchens);
    expect(pos.source).toBe('Mostrador');
    expect(pos.kind).toBe('venta');
    expect(pos.items[0].station).toBe('Parrilla');
  });

  it('marca Mesa si note empieza con Mesa:', () => {
    expect(ticketToPos(ticket({ note: 'Mesa: 4' }), 'Ana', kitchens).source).toBe('Mesa');
  });

  it('kind consumo si origen=consumo', () => {
    expect(ticketToPos(ticket({ origen: 'consumo', total: 0 }), 'Ana', kitchens).kind).toBe(
      'consumo',
    );
  });

  it('kind devolucion si status=devuelto', () => {
    expect(ticketToPos(ticket({ status: 'devuelto' }), 'Ana', kitchens).kind).toBe('devolucion');
  });
});

describe('buildStockMovementsFromCart', () => {
  const salesProducts: SalesProduct[] = [
    {
      id: 'sp1',
      name: 'Burger',
      category: 'Comidas',
      categoriaVentaId: 'c1',
      kitchenId: 'k1',
      price: 1000,
      emoji: '🍔',
      kind: 'simple',
      active: true,
      recipe: [{ stockProductId: 'pan', quantity: 1 }],
      bundle: [],
    },
  ];

  it('venta (direction -1) emite salida de stock', () => {
    const rows = buildStockMovementsFromCart(
      [{ salesProductId: 'sp1', quantity: 2 }],
      salesProducts,
      'venta',
      -1,
      'ticket-12',
      { id: 'u1', name: 'Ana' },
    );
    expect(rows).toEqual([
      expect.objectContaining({
        productId: 'pan',
        quantity: -2,
        type: 'venta',
        reference: 'ticket-12',
      }),
    ]);
  });
});
```

- [ ] **Step 2: Correr y ver el fail de export**

```bash
npm --prefix apps/web-admin test -- src/features/sales/pos/ticket-to-pos.test.ts
```

Expected: FAIL — `buildStockMovementsFromCart` is not exported.

- [ ] **Step 3: Exportar la función**

En `VentasPosContext.tsx`, cambiar `function buildStockMovementsFromCart` por `export function buildStockMovementsFromCart`. No moverla de archivo.

- [ ] **Step 4: Tests del carrito → checkout**

`checkout-items.ts`:

```ts
export function cartToCheckoutItems(
  items: Array<{ id: string; qty: number }>,
): Array<{ salesProductId: string; quantity: number }> {
  return items.map((i) => ({ salesProductId: i.id, quantity: i.qty }));
}
```

`checkout-items.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { cartToCheckoutItems } from './checkout-items';

describe('cartToCheckoutItems', () => {
  it('mapea id/qty al contrato de POST /public/orders', () => {
    expect(
      cartToCheckoutItems([
        { id: 'sp-1', qty: 2 },
        { id: 'sp-2', qty: 1 },
      ]),
    ).toEqual([
      { salesProductId: 'sp-1', quantity: 2 },
      { salesProductId: 'sp-2', quantity: 1 },
    ]);
  });
});
```

En `PaymentPage.tsx` reemplazar el `.map` del checkout:

```ts
import { cartToCheckoutItems } from '../cart/checkout-items';
// ...
const order = await publicApi.orders.checkout(
  cartToCheckoutItems(items),
  token,
  `checkout-${Date.now()}`,
);
```

- [ ] **Step 5: Verificar y commit**

```bash
npm --prefix apps/web-admin test -- src/features/sales/pos/ticket-to-pos.test.ts src/features/sales/stock-link.test.ts
npm --prefix apps/web-public test -- src/app/components/public/cart
```

Expected: PASS. Confirmar que existen los 5 archivos HTTP listados en File Structure.

```bash
git add apps/web-admin/src/features/sales/pos/VentasPosContext.tsx apps/web-admin/src/features/sales/pos/ticket-to-pos.test.ts apps/web-public/src/app/components/public/cart/checkout-items.ts apps/web-public/src/app/components/public/cart/checkout-items.test.ts apps/web-public/src/app/components/public/pages/PaymentPage.tsx
git commit -m "test: ticket POS y payload de checkout público como funciones puras."
```

---

### Task 3: `data-testid` + confirm MinIO

**Files:**
- Create: `e2e/fixtures/ids.ts` (constantes; el workspace e2e se crea en Task 4 — si preferís no crear `e2e/` aún, poné las mismas strings literales y copiá el archivo en Task 4. **Creá `e2e/fixtures/ids.ts` ahora** y Task 4 lo mueve al package.)
- Modify: `LoginPage.tsx`, `AppLayout.tsx`, `ModulePlaceholderPage.tsx`
- Modify: `POSModule.tsx`, `PosProductPicker.tsx`, `TablesModule.tsx`, `ConsumptionModule.tsx`, `ReturnsModule.tsx`
- Modify: `OnlineKitchenTicket.tsx`, `OnlineMediaUpload.tsx`
- Modify: `AuthForm.tsx`, `CantinaPage.tsx` (botón +), `PaymentPage.tsx`
- Modify: `PublicLayout.tsx` si hace falta ancla de nav pública (opcional; las páginas se visitan por hash)

**Interfaces:**
- Consumes: nada
- Produces: `e2e/fixtures/ids.ts` exporta exactamente:

```ts
export const ids = {
  loginUser: 'lch-login-user',
  loginPass: 'lch-login-pass',
  loginSubmit: 'lch-login-submit',
  navStock: 'lch-nav-stock',
  navVentas: 'lch-nav-ventas',
  navOnline: 'lch-nav-online',
  navFutbol: 'lch-nav-futbol',
  navSettings: 'lch-nav-settings',
  moduleDenied: 'lch-module-denied',
  posProduct: 'lch-pos-product',
  posCobrar: 'lch-pos-cobrar',
  mesasNueva: 'lch-mesas-nueva',
  mesasNombre: 'lch-mesas-nombre',
  mesasCrear: 'lch-mesas-crear',
  mesasAgregar: 'lch-mesas-agregar',
  mesasCobrar: 'lch-mesas-cobrar',
  consumoSubmit: 'lch-consumo-submit',
  devolucionSubmit: 'lch-devolucion-submit',
  publicLoginEmail: 'lch-public-login-email',
  publicLoginPass: 'lch-public-login-pass',
  publicLoginSubmit: 'lch-public-login-submit',
  cantinaAdd: 'lch-cantina-add',
  cantinaPagar: 'lch-cantina-pagar',
  kdsTicket: 'lch-kds-ticket',
  mediaFile: 'lch-media-file',
  mediaUpload: 'lch-media-upload',
} as const;
```

- [ ] **Step 1: Escribir `ids.ts` y usarlo como contrato**

Crear el archivo de arriba. Los e2e de tasks 4–8 **solo** importan `ids.*`, no strings sueltas.

- [ ] **Step 2: Anclas admin**

`LoginPage.tsx`: `data-testid={ids}` no se puede importar desde `e2e/` en Vite admin. **Copiá los strings literales** (los mismos valores).

- input usuario → `data-testid="lch-login-user"`
- input password → `lch-login-pass`
- submit Ingresar → `lch-login-submit`

`AppLayout.tsx` botones de módulo (`moduleMeta`): `data-testid={\`lch-nav-${moduleId}\`}` (`stock` | `ventas` | `online` | `futbol`). NavLink de configuración → `lch-nav-settings`.

`ModulePlaceholderPage.tsx`: si `denied`, `data-testid="lch-module-denied"` en el `<article>`.

`PosProductPicker.tsx`: el botón que llama `onSelect(p)` → `data-testid="lch-pos-product"` (todos iguales; el e2e usa `.first()`).

`POSModule.tsx`: botón **"Vender sin imprimir"** → `lch-pos-cobrar`.

`TablesModule.tsx`: botón abrir mesa nueva → `lch-mesas-nueva`; input nombre → `lch-mesas-nombre`; confirmar alta → `lch-mesas-crear`; abrir picker de producto → `lch-mesas-agregar`; **"Cobrar y Cerrar Cuenta"** → `lch-mesas-cobrar`.

`ConsumptionModule.tsx`: **"Registrar Consumo"** → `lch-consumo-submit`.

`ReturnsModule.tsx`: el botón que llama `confirm` → `lch-devolucion-submit`.

`OnlineKitchenTicket.tsx`: el `div` raíz → `lch-kds-ticket`.

- [ ] **Step 3: Anclas pública + confirm MinIO**

`AuthForm.tsx`: email `lch-public-login-email`, password `lch-public-login-pass`, submit `lch-public-login-submit`.

`CantinaPage.tsx`: el botón `+` de `qty===0` → `lch-cantina-add`.

`PaymentPage.tsx`: **"Confirmar pedido"** → `lch-cantina-pagar`.

`OnlineMediaUpload.tsx` — input file `lch-media-file`; botón "Subir archivo" `lch-media-upload`. Después del PUT OK, **antes** de `onChange(url)`:

```ts
await mediaApi.confirm(
  {
    key: presign.key,
    title: file.name,
    type: mediaType,
    url,
    mimeType: file.type,
    size: file.size,
  },
  token,
);
```

Si `confirm` tira, el catch existente setea `error` (el e2e no acepta URL sin confirm).

- [ ] **Step 4: Tests unitarios que ya existían siguen verdes**

```bash
npm run test:admin
npm run test:public
```

Expected: PASS (no bajó el coverage por los testids).

- [ ] **Step 5: Commit**

```bash
git add e2e/fixtures/ids.ts apps/web-admin/src/features/platform/pages/LoginPage.tsx apps/web-admin/src/app/layout/AppLayout.tsx apps/web-admin/src/features/platform/pages/ModulePlaceholderPage.tsx apps/web-admin/src/features/sales/pos/POSModule.tsx apps/web-admin/src/features/sales/pos/PosProductPicker.tsx apps/web-admin/src/features/sales/pos/TablesModule.tsx apps/web-admin/src/features/sales/pos/ConsumptionModule.tsx apps/web-admin/src/features/sales/pos/ReturnsModule.tsx apps/web-admin/src/features/online/OnlineKitchenTicket.tsx apps/web-admin/src/features/online/OnlineMediaUpload.tsx apps/web-public/src/app/components/public/auth/AuthForm.tsx apps/web-public/src/app/components/public/pages/CantinaPage.tsx apps/web-public/src/app/components/public/pages/PaymentPage.tsx
git commit -m "feat: anclas data-testid y confirm de upload a MinIO."
```

---

### Task 4: Harness `@lch/e2e` + login RBAC

**Files:**
- Create: `e2e/package.json`, `e2e/playwright.config.ts`, `e2e/global-setup.ts`, `e2e/start-stack.mjs`, `e2e/constants.ts`, `e2e/fixtures/auth.ts`, `e2e/tests/auth.setup.ts`, `e2e/tests/admin/login-rbac.spec.ts`
- Modify: root `package.json` (`workspaces` + scripts)
- Test: el spec `login-rbac` **es** el test del harness

**Interfaces:**
- Consumes: `ids` de Task 3; `reset-test-db.mjs`; seeds de `apps/api`
- Produces:

```ts
// e2e/constants.ts
export const API_URL = 'http://127.0.0.1:3002';
export const ADMIN_URL = 'http://127.0.0.1:5175';
export const PUBLIC_URL = 'http://127.0.0.1:5176';
export const TEST_DATABASE_URL =
  'postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public';
export const JWT_SECRET = 'lch-e2e-jwt-secret-not-for-production';

// e2e/fixtures/auth.ts
export const adminAccounts = {
  admin: { user: 'admin', pass: 'admin123' },
  stock: { user: 'stock', pass: 'stock123' },
  vendedor: { user: 'vendedor', pass: 'vendedor123' },
  gerente: { user: 'gerente', pass: 'gerente123' },
  futbol: { user: 'futbol', pass: 'futbol123' },
  cocina: { user: 'cocina', pass: 'cocina123' },
} as const;
export type AdminRole = keyof typeof adminAccounts;

export const publicAccounts = {
  jugador: { email: 'jugador@lachacra.test', pass: 'jugador123' },
  capitan: { email: 'capitan@lachacra.test', pass: 'capitan123' },
} as const;

export async function loginAdmin(page: Page, role: AdminRole): Promise<void>;
export async function loginPublic(page: Page, who: keyof typeof publicAccounts): Promise<void>;
```

`loginAdmin`: `page.goto(ADMIN_URL + '/')`, fill testids, click submit, `expect(page.getByTestId(ids.loginSubmit)).toHaveCount(0)` **o** esperar que desaparezca el form (el shell quedó visible). Timeout default 45s.

`loginPublic`: `page.goto(PUBLIC_URL + '/#/perfil')`, fill public testids, submit, esperar que el form de login no esté (el perfil muestra el email).

- [ ] **Step 1: Spec RBAC (falla — no hay Playwright)**

`e2e/tests/admin/login-rbac.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.describe('login-rbac', () => {
  test.use({ storageState: '.auth/vendedor.json' });
  test('vendedor no entra a inventario', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/#/stock`);
    await expect(page.getByTestId(ids.moduleDenied)).toBeVisible();
  });
});

test.describe('cocina vs futbol', () => {
  test.use({ storageState: '.auth/cocina.json' });
  test('cocina no entra a futbol', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/#/futbol`);
    await expect(page.getByTestId(ids.moduleDenied)).toBeVisible();
  });
});

test.describe('superadmin settings', () => {
  test.use({ storageState: '.auth/admin.json' });
  test('admin ve configuracion', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/#/`);
    await expect(page.getByTestId(ids.navSettings)).toBeVisible();
    await page.getByTestId(ids.navSettings).click();
    await expect(page).toHaveURL(/configuracion/);
  });
});
```

```bash
npx playwright test -c e2e/playwright.config.ts
```

Expected: FAIL — no config / no browsers.

- [ ] **Step 2: Workspace y config**

Root `package.json`:

```json
"workspaces": ["apps/*", "e2e"],
"test:db": "npm run test:db --workspace=apps/api",
"test:e2e": "npm run test:e2e --workspace=@lch/e2e",
"test:ci": "npm test && npm run test:db && npm run test:e2e"
```

`e2e/package.json`:

```json
{
  "name": "@lch/e2e",
  "private": true,
  "scripts": {
    "test:e2e": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.55.0"
  }
}
```

No script `test`.

```bash
npm install
cd e2e && npx playwright install chromium
```

`e2e/playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';
import { API_URL } from './constants';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  globalSetup: './global-setup.ts',
  use: {
    trace: 'retain-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'node start-stack.mjs',
    url: `${API_URL}/health/ready`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    { name: 'chromium', testMatch: /.*\.spec\.ts/, dependencies: ['setup'] },
  ],
});
```

- [ ] **Step 3: `global-setup.ts` + `start-stack.mjs`**

`global-setup.ts` (usar `spawnSync` como `apps/api/scripts/reset-test-db.mjs`):

```ts
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { TEST_DATABASE_URL } from './constants';

function run(cmd: string, args: string[], cwd: string) {
  const r = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
  });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`);
}

export default async function globalSetup() {
  const api = path.resolve(__dirname, '../apps/api');
  run('node', ['scripts/reset-test-db.mjs'], api);
  run('npm', ['run', 'prisma:seed'], api);
  run('npm', ['run', 'prisma:seed:demo'], api);
}
```

`start-stack.mjs` (completo, no un esqueleto):

1. `assertPortFree(3002)`, `5175`, `5176` — si `EADDRINUSE`, `console.error('puerto en uso, cerrá el e2e anterior')` y `process.exit(1)`.
2. Poll 30s: `GET http://127.0.0.1:5432` no; usar `pg` o `fetch` no sirve. Hacer TCP connect a `127.0.0.1:5432` y `GET http://127.0.0.1:9000/minio/health/live`. Si falla: `levantá npm run dev:infra`.
3. `spawn` API desde `apps/api`:

```js
env: {
  ...process.env,
  PORT: '3002',
  NODE_ENV: 'development',
  DATABASE_URL: TEST_DATABASE_URL,
  DIRECT_URL: TEST_DATABASE_URL,
  JWT_SECRET: 'lch-e2e-jwt-secret-not-for-production',
  MINIO_ENDPOINT: '127.0.0.1',
  MINIO_PORT: '9000',
  MINIO_ACCESS_KEY: 'minio_admin',
  MINIO_SECRET_KEY: 'minio_dev_pass',
  MINIO_USE_SSL: 'false',
}
```

Comando: `npx nest start` (sin `--watch`). Cwd `apps/api`.

4. Vite admin: `npx vite --port 5175 --strictPort --host 127.0.0.1 --open false` cwd `apps/web-admin` env `VITE_API_URL=http://127.0.0.1:3002`.
5. Vite pública: puerto **5176**, mismo `VITE_API_URL`.
6. Poll `GET http://127.0.0.1:3002/health/ready` hasta 200. Si no, exit 1.
7. `SIGTERM`/`SIGINT` mata a los tres hijos.

`e2e/tests/auth.setup.ts`:

```ts
import { test as setup } from '@playwright/test';
import { loginAdmin, loginPublic, adminAccounts, publicAccounts } from '../fixtures/auth';
import type { Browser } from '@playwright/test';

setup('sesiones', async ({ browser }) => {
  for (const role of Object.keys(adminAccounts) as (keyof typeof adminAccounts)[]) {
    const page = await browser.newPage();
    await loginAdmin(page, role);
    await page.context().storageState({ path: `.auth/${role}.json` });
    await page.close();
  }
  for (const who of Object.keys(publicAccounts) as (keyof typeof publicAccounts)[]) {
    const page = await browser.newPage();
    await loginPublic(page, who);
    await page.context().storageState({ path: `.auth/${who}.json` });
    await page.close();
  }
});
```

Implementar `loginAdmin` / `loginPublic` en `fixtures/auth.ts` como arriba.

- [ ] **Step 4: Correr e2e RBAC**

```bash
npm run test:e2e
```

Expected: PASS los 3 casos de `login-rbac`. Si el setup no encuentra el form, el login no persistió `lch-auth-token` — revisar que `persistSession` en `App.tsx` corre.

- [ ] **Step 5: Commit**

```bash
git add e2e package.json package-lock.json
git commit -m "test: harness Playwright e2e y RBAC de login admin."
```

---

### Task 5: E2E admin inventario + POS + mesa/devolución/consumo

**Files:**
- Create: `e2e/tests/admin/inventario.spec.ts`
- Create: `e2e/tests/admin/pos-mostrador.spec.ts`
- Create: `e2e/tests/admin/pos-mesa-devolucion-consumo.spec.ts`

**Interfaces:**
- Consumes: `ids`, `ADMIN_URL`, storageState `stock` / `vendedor` / `gerente`
- Produces: tres specs verdes

Helper local en cada spec (no un framework):

```ts
async function pickFirstProduct(page: Page) {
  await page.getByTestId(ids.posProduct).first().click();
}
```

- [ ] **Step 1: Specs (red)**

`inventario.spec.ts` — `storageState: '.auth/stock.json'`:

```ts
test('productos, almacenes y pedidos listan seed', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/productos`);
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
  await expect(page.locator('table, [role="table"], tbody tr').first()).toBeVisible();
  await page.goto(`${ADMIN_URL}/#/almacenes`);
  await expect(page.getByRole('heading', { name: /Almacenes|Depósitos/i })).toBeVisible();
  await page.goto(`${ADMIN_URL}/#/pedidos`);
  await expect(page.locator('body')).toContainText(/Pedido|Proveedor|Borrador|Recibido/i);
});
```

Ajustá el heading al texto real de `WarehousesPage` / `OrdersPage` si no coincide (leé el `<h1>`). No uses `waitForTimeout`.

`pos-mostrador.spec.ts` — `vendedor.json`:

```ts
test('cobra un item sin imprimir', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/ventas?tab=mostrador`);
  await pickFirstProduct(page);
  await page.getByTestId(ids.posCobrar).click();
  await expect(page.getByText(/Ticket #|Último pedido/i)).toBeVisible();
});
```

`pos-mesa-devolucion-consumo.spec.ts` — `gerente.json`, **un solo test** (misma siembra):

1. `#/ventas?tab=mesas` → `lch-mesas-nueva` → nombre `e2e-mesa-<Date.now()>` → crear → agregar producto (`lch-pos-product` o `lch-mesas-agregar`) → `lch-mesas-cobrar` → `page.once('dialog', d => d.accept())`.
2. `#/ventas?tab=devoluciones` → primer producto returnable → `lch-devolucion-submit` → texto `Devolución`.
3. `#/ventas?tab=consumo` → producto → `lch-consumo-submit` → texto `Consumo`.

- [ ] **Step 2: Correr y fallar por specs ausentes / UI**

```bash
npm run test:e2e -- tests/admin/inventario.spec.ts
```

Expected: FAIL hasta crear los archivos e iterar selectores. Si el heading no existe, cambiá el expect al `<h1>` real, no al revés.

- [ ] **Step 3: Implementar los tres archivos**

Código como en Step 1, con los headings reales.

- [ ] **Step 4: Suite admin de esta task verde**

```bash
npm run test:e2e -- tests/admin
```

Expected: PASS (incluye login-rbac).

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/admin
git commit -m "test: e2e admin de inventario, POS, mesa, devolución y consumo."
```

---

### Task 6: E2E admin online, media, fútbol, reportes

**Files:**
- Create: `e2e/tests/admin/online-cms.spec.ts`
- Create: `e2e/tests/admin/media-upload.spec.ts`
- Create: `e2e/tests/admin/futbol.spec.ts`
- Create: `e2e/tests/admin/reportes-config.spec.ts`

**Interfaces:**
- Consumes: `ids`, `pixel.png`, storageState `admin` / `futbol`
- Produces: upload MinIO con `publicUrl` HTTP 200

- [ ] **Step 1: Specs**

`online-cms.spec.ts` — `admin.json`:

```ts
test('menu o sponsor y metricas', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/online?tab=sponsors`);
  await expect(page.getByText(/sponsor/i).first()).toBeVisible();
  await page.goto(`${ADMIN_URL}/#/online?tab=metricas`);
  await expect(page.locator('body')).not.toContainText('Acceso denegado');
});
```

`media-upload.spec.ts` — `admin.json`:

```ts
import path from 'node:path';
import { ids } from '../../fixtures/ids';

test('PNG a MinIO y publicUrl 200', async ({ page, request }) => {
  await page.goto(`${ADMIN_URL}/#/online?tab=sponsors`);
  await page.getByRole('button', { name: /Agregar sponsor/i }).click();
  const file = path.resolve(__dirname, '../../fixtures/files/pixel.png');
  await page.getByTestId(ids.mediaFile).setInputFiles(file);
  const img = page.locator('img[src*="lch-media"], img[src*="127.0.0.1:9000"]').last();
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect(src).toBeTruthy();
  const res = await request.get(src!);
  expect(res.status()).toBe(200);
});
```

`futbol.spec.ts` — `futbol.json`:

```ts
test('equipos y fixture', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/futbol?tab=equipos`);
  await expect(page.locator('body')).toContainText(/equipo/i);
  await page.goto(`${ADMIN_URL}/#/futbol?tab=fixture`);
  await expect(page.locator('body')).toContainText(/fixture|jornada|fecha/i);
});
```

**Prohibido** click en regenerar/publicar.

`reportes-config.spec.ts` — `admin.json`:

```ts
test('reportes y config', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/reportes`);
  await expect(page.locator('body')).not.toContainText('Acceso denegado');
  await page.goto(`${ADMIN_URL}/#/configuracion`);
  await expect(page.getByTestId(ids.navSettings)).toBeVisible();
});
```

- [ ] **Step 2: PNG 1×1**

Crear `e2e/fixtures/files/pixel.png` (decodificar este base64):

```
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
```

```bash
node -e "require('fs').writeFileSync('e2e/fixtures/files/pixel.png', Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==','base64'))"
```

- [ ] **Step 3: Correr**

```bash
npm run test:e2e -- tests/admin/media-upload.spec.ts tests/admin/online-cms.spec.ts tests/admin/futbol.spec.ts tests/admin/reportes-config.spec.ts
```

Expected: PASS. Si el file input está `hidden`, `setInputFiles` igual funciona sobre el input. Si MinIO no tiene bucket, `start-stack` ya debió fallar; en local `minio-init` del compose los crea.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/admin/online-cms.spec.ts e2e/tests/admin/media-upload.spec.ts e2e/tests/admin/futbol.spec.ts e2e/tests/admin/reportes-config.spec.ts e2e/fixtures/files/pixel.png
git commit -m "test: e2e admin de CMS, upload MinIO, fútbol y reportes."
```

---

### Task 7: E2E pública

**Files:**
- Create: `e2e/tests/public/paginas-invitado.spec.ts`
- Create: `e2e/tests/public/auth-password.spec.ts`
- Create: `e2e/tests/public/cantina-checkout.spec.ts`
- Create: `e2e/tests/public/pedidos-qr.spec.ts`

**Interfaces:**
- Consumes: `PUBLIC_URL`, `ids`, `jugador.json` / `capitan.json`
- Produces: pedido real en `lch_stock_test` (sirve a Task 8)

`USE_MOCK_FUTBOL` sigue `true`. `resolveMockRole` mapea `jugador@` / `capitan@` a esos roles — **no** apagues el mock.

- [ ] **Step 1: Specs**

`paginas-invitado.spec.ts` — **sin** storageState (contexto limpio):

```ts
for (const [hash, re] of [
  ['#/', /La Chacra|Inicio|Cantina|Torneo/i],
  ['#/torneo', /torneo|tabla|posicion/i],
  ['#/cantina', /cantina|comida|menu/i],
  ['#/fotos', /foto|video|galer/i],
  ['#/reglamento', /reglamento/i],
] as const) {
  test(`render ${hash}`, async ({ page }) => {
    await page.goto(`${PUBLIC_URL}/${hash}`);
    await expect(page.locator('body')).toContainText(re);
  });
}
```

`auth-password.spec.ts`:

```ts
test.describe('jugador', () => {
  test.use({ storageState: '.auth/jugador.json' });
  test('perfil y no administra equipo', async ({ page }) => {
    await page.goto(`${PUBLIC_URL}/#/perfil`);
    await expect(page.locator('body')).toContainText('jugador@lachacra.test');
    await page.goto(`${PUBLIC_URL}/#/administrar-equipo`);
    await expect(page).toHaveURL(/perfil/);
  });
});

test.describe('capitan', () => {
  test.use({ storageState: '.auth/capitan.json' });
  test('entra a administrar-equipo', async ({ page }) => {
    await page.goto(`${PUBLIC_URL}/#/administrar-equipo`);
    await expect(page).toHaveURL(/administrar-equipo/);
    await expect(page.locator('body')).not.toHaveText(/Acceso denegado/i);
  });
});
```

`cantina-checkout.spec.ts` — `jugador.json`:

```ts
test('add carrito pago pedido', async ({ page }) => {
  await page.goto(`${PUBLIC_URL}/#/cantina`);
  await page.getByTestId(ids.cantinaAdd).first().click();
  await page.goto(`${PUBLIC_URL}/#/pago`);
  await page.getByTestId(ids.cantinaPagar).click();
  await expect(page).toHaveURL(/qr/);
});
```

`pedidos-qr.spec.ts` — `jugador.json` (corre **después** del checkout en el mismo worker/siembra; si el orden no está garantizado, el test de pedidos hace su propio checkout igual que el anterior):

```ts
test('pedidos y qr', async ({ page }) => {
  await page.goto(`${PUBLIC_URL}/#/cantina`);
  await page.getByTestId(ids.cantinaAdd).first().click();
  await page.goto(`${PUBLIC_URL}/#/pago`);
  await page.getByTestId(ids.cantinaPagar).click();
  await page.goto(`${PUBLIC_URL}/#/pedidos`);
  await expect(page.locator('body')).toContainText(/pedido|retiro|qr|#/i);
  await page.goto(`${PUBLIC_URL}/#/qr`);
  await expect(page.locator('body')).toContainText(/qr|retiro|pedido/i);
});
```

- [ ] **Step 2: Correr**

```bash
npm run test:e2e -- tests/public
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/public
git commit -m "test: e2e pública (páginas, login, cantina, pedidos y QR)."
```

---

### Task 8: E2E cruces (SSE, stock, pedido admin)

**Files:**
- Create: `e2e/tests/cross/cantina-kds-sse.spec.ts`
- Create: `e2e/tests/cross/pos-stock.spec.ts`
- Create: `e2e/tests/cross/pedido-online-admin.spec.ts`

**Interfaces:**
- Consumes: dos `browser` contexts; `API_URL`; tokens en `lch-auth-token` / `lch_public_token`
- Produces: el KDS muestra `lch-kds-ticket` **sin** `page.reload()`

- [ ] **Step 1: Specs**

`cantina-kds-sse.spec.ts`:

```ts
test('pedido pública aparece en KDS sin reload', async ({ browser }) => {
  const kds = await browser.newContext({ storageState: '.auth/cocina.json' });
  const pub = await browser.newContext({ storageState: '.auth/jugador.json' });
  const kdsPage = await kds.newPage();
  const pubPage = await pub.newPage();

  await kdsPage.goto(`${ADMIN_URL}/#/online?tab=cocina`);
  await expect(kdsPage.getByText(/Cocina/i).first()).toBeVisible();
  const before = await kdsPage.getByTestId(ids.kdsTicket).count();

  await pubPage.goto(`${PUBLIC_URL}/#/cantina`);
  await pubPage.getByTestId(ids.cantinaAdd).first().click();
  await pubPage.goto(`${PUBLIC_URL}/#/pago`);
  await pubPage.getByTestId(ids.cantinaPagar).click();
  await expect(pubPage).toHaveURL(/qr/);

  await expect(kdsPage.getByTestId(ids.kdsTicket)).toHaveCount(before + 1);
  await kds.close();
  await pub.close();
});
```

Si la cocina vacía muestra "No hay pedidos", `before` es 0 y el expect espera 1. **No** llames `reload`.

`pos-stock.spec.ts` — context `stock` + `vendedor`:

1. Con `request` (Playwright) login API `stock`/`stock123` → `GET ${API_URL}/stock/products` (o el primer producto del seed con `GET .../products/:id/stock`).
2. Guardar `quantity` de un insumo que use el primer producto de venta.
3. Context vendedor: misma venta que `pos-mostrador`.
4. Volver a GET stock; `expect(after).toBeLessThan(before)`.

Si el primer producto POS no mueve ese insumo, leé el primer `lch-pos-product` visible y buscá su receta vía `GET /sales/products` (el client admin ya usa esa ruta — confirmá en `sales.controller.ts`; si la lista es `GET /sales/products`, usala).

`pedido-online-admin.spec.ts`:

1. Context jugador: checkout cantina.
2. Context admin: `#/online?tab=cocina` **o** el listado de pedidos online si existe en métricas/pedidos. Assert texto del producto o `lch-kds-ticket`.

- [ ] **Step 2: Correr cruces**

```bash
npm run test:e2e -- tests/cross
```

Expected: PASS. Si SSE no llega, no agregues reload; arreglá el KDS (EventSource ya está en `adapters.ts`) o el `LISTEN` (la API e2e usa `lch_stock_test`).

- [ ] **Step 3: Suite e2e completa**

```bash
npm run test:e2e
```

Expected: PASS todos los specs.

- [ ] **Step 4: Commit**

```bash
git add e2e/tests/cross
git commit -m "test: e2e cruzados cantina-KDS, POS-stock y pedido online."
```

---

### Task 9: CI + RUNBOOK

**Files:**
- Create: `.github/workflows/test.yml`
- Modify: `docs/RUNBOOK.md` (sección Tests)
- Modify: root `package.json` si `test:ci` / `test:e2e` no quedaron en Task 4

**Interfaces:**
- Consumes: scripts de Task 4
- Produces: Actions required en PR/push; `npm run test:ci` local

- [ ] **Step 1: Workflow**

`.github/workflows/test.yml`:

```yaml
name: test
on:
  push:
  pull_request:

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - run: npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: coverage
          path: |
            apps/api/coverage
            apps/web-admin/coverage
            apps/web-public/coverage

  integrity:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: lch
          POSTGRES_PASSWORD: lch_dev_pass
          POSTGRES_DB: lch_stock
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U lch -d lch_stock"
          --health-interval 5s --health-timeout 5s --health-retries 10
      minio:
        image: minio/minio
        env:
          MINIO_ROOT_USER: minio_admin
          MINIO_ROOT_PASSWORD: minio_dev_pass
        ports: ['9000:9000']
        command: server /data
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm
      - run: npm ci
      - name: Create lch_stock_test
        env:
          PGPASSWORD: lch_dev_pass
        run: psql -h 127.0.0.1 -U lch -d lch_stock -c "CREATE DATABASE lch_stock_test;"
      - name: MinIO buckets
        run: |
          docker run --rm --network host --entrypoint /bin/sh minio/mc -c "
            until mc alias set local http://127.0.0.1:9000 minio_admin minio_dev_pass; do sleep 1; done
            mc mb local/lch-media || true
            mc mb local/lch-sponsors || true
            mc mb local/lch-football || true
            mc anonymous set download local/lch-media
            mc anonymous set download local/lch-sponsors
            mc anonymous set download local/lch-football
          "
      - run: npm run test:db
        env:
          TEST_DATABASE_URL: postgresql://lch:lch_dev_pass@127.0.0.1:5432/lch_stock_test?schema=public
      - run: npx playwright install --with-deps chromium
        working-directory: e2e
      - run: npm run test:e2e
        env:
          CI: true
          TEST_DATABASE_URL: postgresql://lch:lch_dev_pass@127.0.0.1:5432/lch_stock_test?schema=public
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: |
            e2e/playwright-report
            e2e/test-results
```

Sin `continue-on-error`. Los dos jobs son el check del workflow (required al proteger la rama; el YAML no puede marcar required solo — documentalo en RUNBOOK).

- [ ] **Step 2: RUNBOOK**

Al final de `docs/RUNBOOK.md` (o tras "Database commands"):

```markdown
## Tests

- `npm test` — Vitest + coverage (sin browser, sin Postgres).
- `npm run test:db` — constraints en `lch_stock_test` (requiere `npm run dev:infra`).
- `npm run test:e2e` — reset de `lch_stock_test` + API :3002 + admin :5175 + pública :5176 + Chromium.
  No uses 3001/5173/5174. Si un puerto e2e está ocupado, cerrá el e2e anterior.
- `npm run test:ci` — las tres capas en serie (atajo local; Actions parte unit / integrity).
```

- [ ] **Step 3: Verificar local lo que se pueda**

```bash
npm test
npm run test:db
npm run test:e2e
```

Expected: PASS. No hace falta `test:ci` entero si las tres ya pasaron (es la concatenación).

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/test.yml docs/RUNBOOK.md package.json
git commit -m "ci: Vitest y Playwright en Actions; documentar test:e2e."
```

---

## Self-review (plan vs spec)

| Spec | Task |
|---|---|
| Coverage + umbral medido + críticos API | 1 |
| POS funciones puras; carrito→pedido; HTTP solo si faltaba | 2 (HTTP = no agregar) |
| Workspace `/e2e`, start-stack, global-setup, 1 worker | 4 |
| `data-testid` canónicos | 3 + `ids.ts` |
| Auth seed / storageState | 4 `auth.setup.ts` |
| MinIO upload + confirm + buckets CI | 3 confirm, 6 spec, 9 buckets |
| SSE KDS sin reload | 8 |
| Matriz admin / pública / cross | 5–8 |
| Comandos `test` / `test:db` / `test:e2e` / `test:ci` | 4 + 9 |
| CI dos jobs, fail ruidoso, artefactos | 9 |
| Fuera de alcance (Google, Electron, Redis, legacy) | Global Constraints |

Huecos cerrados en este review: `OnlineMediaUpload` no llamaba `confirm` (Task 3); `npm test` no debe disparar Playwright (Task 4, sin script `test` en e2e); `USE_MOCK_FUTBOL` se deja en `true` (Task 7).
