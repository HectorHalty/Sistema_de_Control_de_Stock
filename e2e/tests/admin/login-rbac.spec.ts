import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.describe('login-rbac', () => {
  test.use({ storageState: '.auth/vendedor.json' });
  test('vendedor no entra a inventario', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/#/stock`);
    await expect(page.getByTestId(ids.moduleDenied)).toBeVisible();
  });
});

test.describe('cocina vs futbol', () => {
  test.use({ storageState: '.auth/cocina.json' });
  test('cocina no entra a futbol', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/#/futbol`);
    await expect(page.getByTestId(ids.moduleDenied)).toBeVisible();
  });
});

test.describe('superadmin settings', () => {
  test.use({ storageState: '.auth/admin.json' });
  test('admin ve configuracion', async ({ page }) => {
    await page.goto(`${ADMIN_URL}/#/`);
    await expect(page.getByTestId(ids.navSettings)).toBeVisible();
    await page.getByTestId(ids.navSettings).click();
    await expect(page).toHaveURL(/configuracion/);
  });
});
