import { expect, test } from '@playwright/test';
import { PUBLIC_URL } from '../../constants';
import { ids } from '../../fixtures/ids';
import { dismissRepeatOrderModal } from '../../fixtures/cantina';

test.use({ storageState: '.auth/jugador.json' });

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
  await expect(page.getByRole('heading', { name: 'Mis Pedidos' })).toBeVisible();

  await page.goto(`${PUBLIC_URL}/#/qr`);
  await expect(page.getByRole('heading', { name: 'Tu código de retiro está listo' })).toBeVisible();
});
