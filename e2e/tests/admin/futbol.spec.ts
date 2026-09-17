import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';

test.use({ storageState: '.auth/futbol.json' });

// Solo lectura: no se clickea ningún control de "regenerar"/"publicar"
// (FixturePanel tiene `publishJornada`/`suspendRain`, ver
// apps/web-admin/src/features/futbol/panels/FixturePanel.tsx:126-158) — este
// spec únicamente navega y verifica texto visible.
test('equipos y fixture', async ({ page }) => {
  await page.goto(`${ADMIN_URL}/#/futbol?tab=equipos`);
  await expect(page).toHaveURL(/tab=equipos/);
  await expect(page.getByRole('heading', { name: 'Equipos' })).toBeVisible();

  await page.goto(`${ADMIN_URL}/#/futbol?tab=fixture`);
  await expect(page).toHaveURL(/tab=fixture/);
  await expect(page.getByRole('heading', { name: 'Fixture' })).toBeVisible();
});
