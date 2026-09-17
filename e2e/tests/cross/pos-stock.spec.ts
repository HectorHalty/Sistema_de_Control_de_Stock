import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { API_URL, ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';
import { adminAccounts } from '../../fixtures/auth';
import { login } from '../../fixtures/api';

type SalesProduct = {
  id: string;
  name: string;
  active: boolean;
  kind: 'simple' | 'promo';
  recipe: Array<{ stockProductId: string; quantity: string | number; stockProduct: { name: string } }>;
};

type StockLevel = { quantity: string | number };

/** `lch-pos-product` es un botón cuyo texto propio incluye nombre + categoría
 *  + estación + precio + "Disp.: N" (ver PosProductPicker.tsx:238-292), así
 *  que filtrar ese botón por `hasText: <nombre>` puede matchear el producto
 *  equivocado si el picker todavía no terminó de cargar cuando se evalúa el
 *  filtro (Playwright reintenta el click, no el `.filter()`, así que un
 *  `.first()` tomado en el momento incorrecto puede clickear cualquier cosa).
 *  Vamos directo al `<div>` que sólo contiene el nombre (match exacto) y
 *  subimos al botón ancestro por testid. */
async function clickPosProductByExactName(page: Page, name: string) {
  await expect(page.getByTestId(ids.posProduct).first()).toBeVisible();
  const nameEl = page.getByText(name, { exact: true }).first();
  await expect(nameEl).toBeVisible();
  await nameEl.locator('xpath=ancestor::button[@data-testid="lch-pos-product"]').first().click();
}

/** Suma niveles de stock de un insumo en todos los almacenes. `quantity` viaja
 *  como string (Prisma.Decimal se serializa así por defecto), de ahí el
 *  Number(...) explícito. */
async function readStock(request: APIRequestContext, token: string, stockProductId: string): Promise<number> {
  const res = await request.get(`${API_URL}/stock/products/${stockProductId}/stock`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.ok(), 'GET /stock/products/:id/stock debe responder 2xx').toBeTruthy();
  const levels = (await res.json()) as StockLevel[];
  return levels.reduce((sum, l) => sum + Number(l.quantity), 0);
}

test.use({ storageState: '.auth/vendedor.json' });

test('una venta POS de un producto con receta baja el stock del insumo', async ({ page, request }) => {
  // `stock`/`stock123` (Operador_Stock) puede leer /stock/products/:id/stock
  // (STOCK_POS_READ_ROLES) pero NO /sales/products (SALES_READ_ROLES no
  // incluye Operador_Stock) — por eso usamos dos logins distintos, como
  // indica el brief ("login API stock/stock123" + inspección de recetas vía
  // /sales/products, que sí expone el admin/vendedor).
  const vendedorToken = await login(request, adminAccounts.vendedor.user, adminAccounts.vendedor.pass);
  const stockToken = await login(request, adminAccounts.stock.user, adminAccounts.stock.pass);

  const productsRes = await request.get(`${API_URL}/sales/products`, {
    headers: { Authorization: `Bearer ${vendedorToken}` },
  });
  expect(productsRes.ok()).toBeTruthy();
  const products = (await productsRes.json()) as SalesProduct[];

  // Buscamos un producto de venta "simple" con receta cuyo insumo tenga stock
  // suficiente para al menos una unidad — así garantizamos que además
  // aparezca vendible en el picker del POS (PosProductPicker filtra
  // `p.stock <= 0`, calculado a partir de la receta real).
  let target: { productName: string; stockProductId: string; before: number } | null = null;
  for (const p of products) {
    if (!p.active || p.kind !== 'simple' || !p.recipe.length) continue;
    const item = p.recipe[0];
    const needed = Number(item.quantity);
    const available = await readStock(request, stockToken, item.stockProductId);
    if (available >= needed && needed > 0) {
      target = { productName: p.name, stockProductId: item.stockProductId, before: available };
      break;
    }
  }
  expect(
    target,
    'Debe existir al menos un producto de venta "simple" con receta vendible (stock >= 1 unidad)',
  ).toBeTruthy();

  await page.goto(`${ADMIN_URL}/#/ventas?tab=mostrador`);
  await clickPosProductByExactName(page, target!.productName);
  await page.getByTestId(ids.posCobrar).click();
  // Ojo: ni "Ticket #\d+" ni "el botón de cobrar está disabled" alcanzan acá.
  // La corrida completa deja tickets previos (seed + otros specs), así que
  // "Ticket #\d+" puede matchear el "Último pedido" de ANTES de nuestro click
  // (VentasPosContext lo repuebla desde una lista aparte). Y el botón queda
  // disabled tanto por `saleBusy` (mientras la venta está en curso) como por
  // `order.length === 0` (POSModule.tsx:212) — o sea, se pone disabled ni bien
  // arranca el checkout, no sólo cuando termina. La señal inequívoca de
  // "terminó con éxito" es que el carrito se vacíe: `finalizeOrder` sólo llama
  // `setOrder([])` después de que `storePrint` (el POST real) resuelve con
  // éxito (POSModule.tsx:84-92), y recién ahí reaparece el placeholder vacío.
  await expect(page.getByText('Toca productos para agregarlos')).toBeVisible();

  const after = await readStock(request, stockToken, target!.stockProductId);
  expect(after).toBeLessThan(target!.before);
});
