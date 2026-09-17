import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.use({ storageState: '.auth/admin.json' });

test('reportes y config', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/reportes`);
  await expect(page.locator('body')).not.toContainText('Acceso denegado');

  await page.goto(`${ADMIN_URL}/#/configuracion`);
  await expect(page.getByTestId(ids.navSettings)).toBeVisible();
});
