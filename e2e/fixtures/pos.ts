import type { Page } from '@playwright/test';
import { ids } from './ids';

/** Clickea el primer producto listado en el picker del POS (mostrador/mesas). */
export async function pickFirstProduct(page: Page) {
  await page.getByTestId(ids.posProduct).first().click();
}
