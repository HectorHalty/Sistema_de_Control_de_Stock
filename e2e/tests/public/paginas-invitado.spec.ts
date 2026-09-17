import { expect, test } from '@playwright/test';
import { PUBLIC_URL } from '../../constants';

// Sin storageState: contexto limpio (invitado, sin sesión).
test.use({ storageState: { cookies: [], origins: [] } });

for (const [hash, re] of [
  ['#/', /La Chacra|Inicio|Cantina|Comidas|Torneo/i],
  ['#/torneo', /torneo|tabla|posicion/i],
  ['#/cantina', /cantina|comida|menu/i],
  ['#/fotos', /foto|video|galer/i],
  ['#/reglamento', /reglamento/i],
] as const) {
  test(`render ${hash}`, async ({ page }) => {
    await page.goto(`${PUBLIC_URL}/${hash}`);
    await expect(page.locator('body')).toContainText(re);
  });
}
