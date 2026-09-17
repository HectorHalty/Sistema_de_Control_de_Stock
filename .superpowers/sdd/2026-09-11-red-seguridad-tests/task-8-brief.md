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

