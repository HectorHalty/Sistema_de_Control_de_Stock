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

