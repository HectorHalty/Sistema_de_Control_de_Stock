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

