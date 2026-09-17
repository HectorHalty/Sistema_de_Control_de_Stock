import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.use({ storageState: '.auth/vendedor.json' });

async function pickFirstProduct(page: Page) {
  await page.getByTestId(ids.posProduct).first().click();
}

test('cobra un item sin imprimir', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/ventas?tab=mostrador`);
  await pickFirstProduct(page);
  await page.getByTestId(ids.posCobrar).click();
  // "Ticket #<n>" y "Último pedido" aparecen juntos en la tarjeta del último
  // pedido; matcheamos el número para evitar la violación de "strict mode"
  // (el texto "Último pedido" del título de la sección también matchea la
  // alternativa genérica).
  await expect(page.getByText(/Ticket #\d+/)).toBeVisible();
});
