import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';
import { pickFirstProduct } from '../../fixtures/pos';

test.use({ storageState: '.auth/vendedor.json' });

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
