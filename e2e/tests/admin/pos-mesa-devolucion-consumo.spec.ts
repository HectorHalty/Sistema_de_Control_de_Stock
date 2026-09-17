import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';
import { pickFirstProduct } from '../../fixtures/pos';

test.use({ storageState: '.auth/gerente.json' });

test('mesa cobrada habilita devolución y registra consumo', async ({ page }) => {
  const mesaName = `e2e-mesa-${Date.now()}`;
  // Deep-link deliberado: si AuthenticatedApp sincroniza el rol en un effect
  // posterior al primer render, SalesModule reescribe a tab=mostrador y este
  // expect falla (lch-mesas-nueva no existe en Mostrador).
  await page.goto(`${ADMIN_URL}/#/ventas?tab=mesas`);
  await expect(page).toHaveURL(/tab=mesas/);
  await expect(page.getByTestId(ids.mesasNueva)).toBeVisible();

  await page.getByTestId(ids.mesasNueva).click();
  await page.getByTestId(ids.mesasNombre).fill(mesaName);
  await page.getByTestId(ids.mesasCrear).click();
  // `openTeam()` ya deja la cuenta seleccionada (`setSelected(id)`), pero en
  // la práctica el panel de detalle no siempre queda montado con ese primer
  // render; seleccionamos la cuenta explícitamente desde la lista para que
  // el test no dependa de esa selección automática.
  await page.getByRole('button', { name: new RegExp(mesaName) }).click();
  await expect(page.getByRole('heading', { name: mesaName })).toBeVisible();

  await page.getByTestId(ids.mesasAgregar).click();
  const addProductModal = page.getByTestId(ids.mesasModalAgregar);
  await expect(addProductModal).toBeVisible();
  const productBtn = addProductModal
    .locator('button')
    .filter({ has: page.locator('div.text-2xl') })
    .first();
  const productName = (await productBtn.locator('.text-sm.text-foreground').innerText()).trim();
  await productBtn.click();
  await addProductModal.locator('svg.lucide-x').click();

  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId(ids.mesasCobrar).click();
  await expect(page.getByText(mesaName)).toHaveCount(0);

  // 2) Devolución: el ticket recién cobrado en la mesa queda disponible como
  // producto vendido devolvible. Cambiamos de pestaña por el nav lateral (no
  // por URL) para no perder el estado en memoria de `ctx.salesTickets` ni
  // repetir el mount inicial (con su carrera rol/URL) en cada paso.
  await page.getByRole('button', { name: 'Devoluciones' }).click();
  await page
    .getByRole('button', {
      name: new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    })
    .click();
  await page.getByTestId(ids.devolucionSubmit).click();
  // El comprobante de devolución también contiene "Devolución" en el texto,
  // así que matcheamos por el toast de confirmación puntualmente para evitar
  // la violación de "strict mode".
  await expect(page.getByText(/Devolución #\d+ registrada/)).toBeVisible();
  // Confirmar abre además un modal con el comprobante de devolución que tapa
  // el resto de la UI (incluido el nav lateral); lo cerramos antes de seguir.
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();

  // 3) Consumo interno: registrar un producto sin cobrar.
  await page.getByRole('button', { name: 'Registrar Consumo' }).click();
  await pickFirstProduct(page);
  await page.getByTestId(ids.consumoSubmit).click();
  // Ídem: "Consumo" también aparece en el nav lateral ("Registrar Consumo") y
  // en el título del módulo, así que matcheamos el toast de confirmación.
  await expect(page.getByText(/Consumo #\d+ registrado/)).toBeVisible();
});
