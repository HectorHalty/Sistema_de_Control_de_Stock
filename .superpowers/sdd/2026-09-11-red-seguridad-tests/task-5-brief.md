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

