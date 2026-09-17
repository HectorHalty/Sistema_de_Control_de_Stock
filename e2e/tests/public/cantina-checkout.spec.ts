import { expect, test, type Page } from '@playwright/test';
import { PUBLIC_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.use({ storageState: '.auth/jugador.json' });

/** El seed de demo deja un pedido previo para `jugador@lachacra.test`, así que
 *  `CantinaPage` abre el modal "¿Repetimos?" apenas hay orders + carrito vacío
 *  (ver `RepeatOrderModal` en CantinaPage.tsx). Lo cerramos si aparece para no
 *  bloquear los clicks de "agregar" con su overlay. */
async function dismissRepeatOrderModal(page: Page) {
  const skip = page.getByRole('button', { name: 'No, gracias' });
  try {
    await skip.waitFor({ state: 'visible', timeout: 3000 });
    await skip.click();
  } catch {
    // No había modal de "repetir pedido" pendiente.
  }
}

test('add carrito pago pedido', async ({ page }) => {
  await page.goto(`${PUBLIC_URL}/#/cantina`);
  await dismissRepeatOrderModal(page);
  await page.getByTestId(ids.cantinaAdd).first().click();
  await page.goto(`${PUBLIC_URL}/#/pago`);
  await page.getByTestId(ids.cantinaPagar).click();
  // El botón de pago sólo navega a /qr dentro del bloque `try` de
  // `PaymentPage.handleConfirm`, después de que `publicApi.orders.checkout`
  // (POST real a la API) resuelve con éxito — no hay redirect en el catch.
  // Llegar a /qr es evidencia de que el pedido quedó escrito en la base.
  await expect(page).toHaveURL(/qr/);
  // El QR y el ticket que se muestran vienen de la orden real devuelta por
  // el backend (no de un mock): confirmamos que la pantalla post-pedido
  // efectivamente renderizó ese estado.
  await expect(page.locator('body')).toContainText(/código de retiro|retiro/i);
});
