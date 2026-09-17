import { expect, test, type Page } from '@playwright/test';
import { PUBLIC_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.use({ storageState: '.auth/jugador.json' });

/** Igual que en cantina-checkout.spec.ts: el seed de demo deja un pedido
 *  previo para `jugador@lachacra.test`, que dispara el modal "¿Repetimos?"
 *  en CantinaPage. Lo cerramos si aparece antes de tocar "agregar". */
async function dismissRepeatOrderModal(page: Page) {
  const skip = page.getByRole('button', { name: 'No, gracias' });
  try {
    await skip.waitFor({ state: 'visible', timeout: 3000 });
    await skip.click();
  } catch {
    // No había modal de "repetir pedido" pendiente.
  }
}

// Playwright no garantiza el orden de ejecución entre specs de archivos
// distintos dentro del mismo worker, así que este test arma su propio
// pedido (igual que cantina-checkout.spec.ts) en vez de asumir que ya
// existe uno creado por otra spec.
test('pedidos y qr', async ({ page }) => {
  await page.goto(`${PUBLIC_URL}/#/cantina`);
  await dismissRepeatOrderModal(page);
  await page.getByTestId(ids.cantinaAdd).first().click();
  await page.goto(`${PUBLIC_URL}/#/pago`);
  await page.getByTestId(ids.cantinaPagar).click();
  await expect(page).toHaveURL(/qr/);

  await page.goto(`${PUBLIC_URL}/#/pedidos`);
  await expect(page.locator('body')).toContainText(/pedido|retiro|qr|#/i);

  await page.goto(`${PUBLIC_URL}/#/qr`);
  await expect(page.locator('body')).toContainText(/qr|retiro|pedido/i);
});
