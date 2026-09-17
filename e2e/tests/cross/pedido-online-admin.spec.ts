import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL, API_URL, PUBLIC_URL } from '../../constants';
import { ids } from '../../fixtures/ids';
import { adminAccounts } from '../../fixtures/auth';
import { login } from '../../fixtures/api';
import { dismissRepeatOrderModal } from '../../fixtures/cantina';

async function addFirstProductToCart(page: Page) {
  await page.getByTestId(ids.cantinaAdd).first().click();
}

test.use({ storageState: '.auth/jugador.json' });

test('pedido público queda visible para cocina en el admin', async ({ page, request, browser }) => {
  await page.goto(`${PUBLIC_URL}/#/cantina`);
  await dismissRepeatOrderModal(page);
  await addFirstProductToCart(page);
  await page.goto(`${PUBLIC_URL}/#/pago`);
  await page.getByTestId(ids.cantinaPagar).click();
  await expect(page).toHaveURL(/qr/);

  const orderLocator = page.getByText(/Orden #\d+/);
  await expect(orderLocator).toBeVisible();
  const orderText = await orderLocator.innerText();
  const match = orderText.match(/#(\d+)/);
  expect(match, 'La pantalla de QR debe mostrar el número de orden').not.toBeNull();
  const ticketNumber = Number(match![1]);

  // Ubicamos la cocina real de este pedido vía la API admin (GET
  // /kitchen/orders sin kitchenId trae de todas las cocinas) en vez de
  // asumir cuál va a quedar seleccionada por default en el <select> del KDS.
  const cocinaToken = await login(request, adminAccounts.cocina.user, adminAccounts.cocina.pass);
  const ordersRes = await request.get(`${API_URL}/kitchen/orders?onlineOnly=true`, {
    headers: { Authorization: `Bearer ${cocinaToken}` },
  });
  expect(ordersRes.ok()).toBeTruthy();
  const orders = (await ordersRes.json()) as Array<{ kitchenId: string; ticket: { number: number } | null }>;
  const kitchenOrder = orders.find((o) => o.ticket?.number === ticketNumber);
  expect(kitchenOrder, 'El pedido recién creado debe existir en /kitchen/orders').toBeTruthy();

  const admin = await browser.newContext({ storageState: '.auth/cocina.json' });
  const adminPage = await admin.newPage();
  await adminPage.goto(`${ADMIN_URL}/#/online?tab=cocina`);
  await expect(adminPage.getByText(/Cocina/i).first()).toBeVisible();
  await adminPage.locator('select').first().selectOption(kitchenOrder!.kitchenId);

  const padded = String(ticketNumber).padStart(6, '0');
  await expect(adminPage.getByTestId(ids.kdsTicket).getByText(padded)).toBeVisible();

  await admin.close();
});
