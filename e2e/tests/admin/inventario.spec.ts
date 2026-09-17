import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';

test.use({ storageState: '.auth/stock.json' });

test('productos, almacenes y pedidos listan seed', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/productos`);
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
  await expect(page.locator('table, [role="table"], tbody tr').first()).toBeVisible();

  await page.goto(`${ADMIN_URL}/#/almacenes`);
  await expect(page.getByRole('heading', { name: /Almacenes|Depósitos/i })).toBeVisible();

  await page.goto(`${ADMIN_URL}/#/pedidos`);
  await expect(page.getByRole('heading', { name: 'Pedidos' })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Proveedor' })).toBeVisible();
});
