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

