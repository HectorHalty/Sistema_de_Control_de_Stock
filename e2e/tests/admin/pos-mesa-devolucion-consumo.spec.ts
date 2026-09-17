import { expect, test, type Page } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.use({ storageState: '.auth/gerente.json' });

async function pickFirstProduct(page: Page) {
  await page.getByTestId(ids.posProduct).first().click();
}

test('mesa cobrada habilita devolución y registra consumo', async ({ page }) => {
  // 1) Mesa: abrir cuenta de equipo, agregar un producto y cobrar.
  const mesaName = `e2e-mesa-${Date.now()}`;
  // Navegamos a /ventas (tab por defecto) y recién ahí clickeamos "Mesas" en
  // el nav lateral: si se pide `?tab=mesas` directo por URL, el mount inicial
  // puede resolver el tab por defecto ("mostrador") antes de que el rol del
  // usuario esté hidratado y el efecto de sincronización de VentasModule
  // reemplaza la URL con `tab=mostrador`, dejando la pestaña mesas inalcanzable.
  await page.goto(`${ADMIN_URL}/#/ventas`);
  await page.getByRole('button', { name: 'Mesas' }).click();

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
  // El modal de "Agregar producto" de la mesa no reusa el picker del POS
  // (no tiene lch-pos-product): es una grilla propia de TablesModule, cuyos
  // botones de producto se distinguen del botón de cerrar (ícono X sin
  // contenido) por tener el emoji dentro de un div.text-2xl.
  const addProductModal = page.locator('.fixed.inset-0.z-50');
  await addProductModal
    .locator('button')
    .filter({ has: page.locator('div.text-2xl') })
    .first()
    .click();
  await addProductModal.locator('svg.lucide-x').click();

  page.once('dialog', dialog => dialog.accept());
  await page.getByTestId(ids.mesasCobrar).click();
  await expect(page.getByText(mesaName)).toHaveCount(0);

  // 2) Devolución: el ticket recién cobrado en la mesa queda disponible como
  // producto vendido devolvible. Cambiamos de pestaña por el nav lateral (no
  // por URL) para no perder el estado en memoria de `ctx.salesTickets` ni
  // repetir el mount inicial (con su carrera rol/URL) en cada paso.
  await page.getByRole('button', { name: 'Devoluciones' }).click();
  await page.getByRole('button', { name: /Pendiente de devolver/ }).first().click();
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
