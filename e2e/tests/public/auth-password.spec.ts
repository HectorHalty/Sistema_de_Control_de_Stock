import { expect, test } from '@playwright/test';
import { PUBLIC_URL } from '../../constants';

test.describe('jugador', () => {
  test.use({ storageState: '.auth/jugador.json' });
  test('perfil y no administra equipo', async ({ page }) => {
    await page.goto(`${PUBLIC_URL}/#/perfil`);
    await expect(page.locator('body')).toContainText('jugador@lachacra.test');
    await page.goto(`${PUBLIC_URL}/#/administrar-equipo`);
    // CaptainRoute redirige a /perfil cuando el rol efectivo no es "capitan".
    await expect(page).toHaveURL(/perfil/);
  });
});

test.describe('capitan', () => {
  test.use({ storageState: '.auth/capitan.json' });
  test('entra a administrar-equipo', async ({ page }) => {
    await page.goto(`${PUBLIC_URL}/#/administrar-equipo`);
    await expect(page).toHaveURL(/administrar-equipo/);
    await expect(page.locator('body')).not.toContainText(/Acceso denegado/i);
  });
});
