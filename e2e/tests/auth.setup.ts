import { test as setup } from '@playwright/test';
import { loginAdmin, loginPublic, adminAccounts, publicAccounts } from '../fixtures/auth';

setup('sesiones', async ({ browser }) => {
  for (const role of Object.keys(adminAccounts) as (keyof typeof adminAccounts)[]) {
    const page = await browser.newPage();
    await loginAdmin(page, role);
    await page.context().storageState({ path: `.auth/${role}.json` });
    await page.close();
  }
  for (const who of Object.keys(publicAccounts) as (keyof typeof publicAccounts)[]) {
    const page = await browser.newPage();
    await loginPublic(page, who);
    await page.context().storageState({ path: `.auth/${who}.json` });
    await page.close();
  }
});
