import path from 'node:path';
import { expect, test } from '@playwright/test';
import { ADMIN_URL } from '../../constants';
import { ids } from '../../fixtures/ids';

test.use({ storageState: '.auth/admin.json' });

test('PNG a MinIO y publicUrl 200', async ({ page, request }) => {
  await page.goto(`${ADMIN_URL}/#/online?tab=sponsors`);

  // A diferencia del ejemplo del brief, `SponsorsPanel` no abre un modal al
  // click de "Agregar sponsor" (ese botón es el submit del form de alta):
  // el input de archivo (`ids.mediaFile`, oculto vía `hidden`) ya está
  // montado dentro de `OnlineMediaUpload` apenas se entra a la pestaña. Ver
  // apps/web-admin/src/features/online/OnlineMediaUpload.tsx:73-84 y
  // apps/web-admin/src/features/online/panels/SponsorsPanel.tsx:176-189.
  const file = path.resolve(__dirname, '../../fixtures/files/pixel.png');
  await page.getByTestId(ids.mediaFile).first().setInputFiles(file);

  // El upload real hace presign -> PUT a MinIO -> confirm; al resolver,
  // `onChange(url)` setea `imageUrl` y `OnlineMediaUpload` renderiza el
  // preview `<img src={value} .../>` (no existe mientras `value` está vacío).
  const img = page.locator('img[src*="lch-media"], img[src*="127.0.0.1:9000"]').last();
  await expect(img).toBeVisible();
  const src = await img.getAttribute('src');
  expect(src).toBeTruthy();

  // Round-trip real: HTTP GET contra la URL pública devuelta por MinIO
  // (bucket `lch-media` con política anonymous/download, ver
  // docker-compose.yml:65) — no se mockea ninguna parte de la cadena.
  const res = await request.get(src!);
  expect(res.status()).toBe(200);
});
