import type { Page } from '@playwright/test';

/** El seed de demo deja un pedido previo para `jugador@lachacra.test`, así que
 *  `CantinaPage` abre el modal "¿Repetimos?" apenas hay orders + carrito vacío
 *  (ver `RepeatOrderModal` en CantinaPage.tsx). Lo cerramos si aparece para no
 *  bloquear los clicks de "agregar" con su overlay. */
export async function dismissRepeatOrderModal(page: Page) {
  const skip = page.getByRole('button', { name: 'No, gracias' });
  try {
    await skip.waitFor({ state: 'visible', timeout: 3000 });
    await skip.click();
  } catch {
    // No había modal de "repetir pedido" pendiente.
  }
}
