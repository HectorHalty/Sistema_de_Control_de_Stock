import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';

test.use({ storageState: '.auth/admin.json' });

test('menu o sponsor y metricas', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/online?tab=sponsors`);
  await expect(page.getByText(/sponsor/i).first()).toBeVisible();

  await page.goto(`${ADMIN_URL}/#/online?tab=metricas`);
  await expect(page.locator('body')).not.toContainText('Acceso denegado');
});
