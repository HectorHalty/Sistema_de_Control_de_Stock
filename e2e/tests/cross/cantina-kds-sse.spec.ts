import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL, PUBLIC_URL } from '../../constants';
import { ids } from '../../fixtures/ids';
import { adminAccounts } from '../../fixtures/auth';

type SalesProduct = {
  id: string;
  name: string;
  active: boolean;
  visibleWeb: boolean;
  kitchenId: string;
};

/** El seed de demo deja un pedido previo para `jugador@lachacra.test`, así que
 *  `CantinaPage` abre el modal "¿Repetimos?" apenas hay orders + carrito vacío
 *  (ver `RepeatOrderModal` en CantinaPage.tsx). Lo cerramos si aparece para no
 *  bloquear los clicks de "agregar" con su overlay. Mismo patrón que
 *  `public/cantina-checkout.spec.ts`. */
async function dismissRepeatOrderModal(page: Page) {
  const skip = page.getByRole('button', { name: 'No, gracias' });
  try {
    await skip.waitFor({ state: 'visible', timeout: 3000 });
    await skip.click();
  } catch {
    // No había modal de "repetir pedido" pendiente.
  }
}

/** `lch-cantina-add` sólo existe en el botón "+" mientras `qty === 0`
 *  (CantinaPage.tsx) y ese botón no contiene el nombre del producto como
 *  texto propio — es hermano del <p> con el nombre, ambos dentro del mismo
 *  div "flex flex-1 flex-col p-3" (MenuCard). Subimos al padre del texto y
 *  buscamos el botón ahí para clickear un producto puntual, no "el primero". */
async function addProductToCart(page: Page, name: string) {
  const nameEl = page.getByText(name, { exact: true }).first();
  await nameEl.locator('..').getByTestId(ids.cantinaAdd).click();
}

async function login(request: APIRequestContext, user: string, pass: string): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { username: user, password: pass },
  });
  expect(res.ok(), `login ${user} debe responder 2xx`).toBeTruthy();
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}

test('pedido pública aparece en KDS sin reload', async ({ browser, request }) => {
  // Elegimos de antemano (vía API, no UI) un producto visible en la web y su
  // cocina asociada (`ProductoVenta.kitchenId`, ver sales.service.ts:168).
  // Necesitamos saberlo *antes* de abrir el KDS para poder pararnos en la
  // cocina correcta antes del checkout: si sólo lo supiéramos después, el
  // primer fetch al elegir la cocina ya traería el pedido nuevo y el test no
  // probaría nada sobre el push en vivo.
  const vendedorToken = await login(request, adminAccounts.vendedor.user, adminAccounts.vendedor.pass);
  const productsRes = await request.get(`${API_URL}/sales/products`, {
    headers: { Authorization: `Bearer ${vendedorToken}` },
  });
  expect(productsRes.ok()).toBeTruthy();
  const products = (await productsRes.json()) as SalesProduct[];
  const target = products.find((p) => p.active && p.visibleWeb);
  expect(target, 'Debe existir un producto activo y visible en la web para probar el checkout').toBeTruthy();

  const kds = await browser.newContext({ storageState: '.auth/cocina.json' });
  const pub = await browser.newContext({ storageState: '.auth/jugador.json' });
  const kdsPage = await kds.newPage();
  const pubPage = await pub.newPage();

  await kdsPage.goto(`${ADMIN_URL}/#/online?tab=cocina`);
  await expect(kdsPage.getByText(/Cocina/i).first()).toBeVisible();
  // Nos paramos en la cocina del producto elegido (el <select> no tiene
  // opción "Todas" — CocinaOnlinePanel.tsx filtra por una sola cocina a la
  // vez). Esto dispara un fetch normal, no es el push que estamos probando.
  await kdsPage.locator('select').first().selectOption(target!.kitchenId);

  await pubPage.goto(`${PUBLIC_URL}/#/cantina`);
  await dismissRepeatOrderModal(pubPage);
  await addProductToCart(pubPage, target!.name);
  await pubPage.goto(`${PUBLIC_URL}/#/pago`);
  await pubPage.getByTestId(ids.cantinaPagar).click();
  // Llegar a /qr es evidencia de que el checkout (POST real) se escribió en
  // la base — mismo razonamiento que public/cantina-checkout.spec.ts.
  await expect(pubPage).toHaveURL(/qr/);

  const orderLocator = pubPage.getByText(/Orden #\d+/);
  await expect(orderLocator).toBeVisible();
  const orderText = await orderLocator.innerText();
  const match = orderText.match(/#(\d+)/);
  expect(match, 'La pantalla de QR debe mostrar el número de orden').not.toBeNull();
  const padded = match![1].padStart(6, '0');

  // Clave del test: el KDS ya estaba abierto, en la cocina correcta, ANTES
  // del checkout. Que el ticket nuevo aparezca ahora — sin page.reload() ni
  // ninguna navegación — sólo se explica por el push SSE real (GET
  // /sse/events con LISTEN/NOTIFY del lado API, ver sse.service.ts). El
  // polling de respaldo del panel es de 15s; el timeout de abajo es más
  // corto a propósito para no dejar que una coincidencia de polling lo
  // disfrace de éxito.
  await expect(kdsPage.getByText(padded)).toBeVisible({ timeout: 8_000 });

  await kds.close();
  await pub.close();
});
