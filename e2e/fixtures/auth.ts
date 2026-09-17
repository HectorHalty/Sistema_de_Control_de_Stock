import { expect, type Page } from '@playwright/test';
import { ADMIN_URL, PUBLIC_URL } from '../constants';
import { ids } from './ids';

export const adminAccounts = {
  admin: { user: 'admin', pass: 'admin123' },
  stock: { user: 'stock', pass: 'stock123' },
  vendedor: { user: 'vendedor', pass: 'vendedor123' },
  gerente: { user: 'gerente', pass: 'gerente123' },
  futbol: { user: 'futbol', pass: 'futbol123' },
  cocina: { user: 'cocina', pass: 'cocina123' },
} as const;
export type AdminRole = keyof typeof adminAccounts;

export const publicAccounts = {
  jugador: { email: 'jugador@lachacra.test', pass: 'jugador123' },
  capitan: { email: 'capitan@lachacra.test', pass: 'capitan123' },
} as const;

/** Login admin: llena el form de `LoginPage` y espera a que el shell autenticado quede visible. */
export async function loginAdmin(page: Page, role: AdminRole): Promise<void> {
  const { user, pass } = adminAccounts[role];
  await page.goto(`${ADMIN_URL}/`);
  await page.getByTestId(ids.loginUser).fill(user);
  await page.getByTestId(ids.loginPass).fill(pass);
  await page.getByTestId(ids.loginSubmit).click();
  // El form de login se desmonta al autenticar (AppShell pasa a AuthenticatedApp).
  await expect(page.getByTestId(ids.loginSubmit)).toHaveCount(0);
}

/** Login público: llena `AuthForm` en /#/perfil y espera a que el perfil (con email) reemplace el form. */
export async function loginPublic(page: Page, who: keyof typeof publicAccounts): Promise<void> {
  const { email, pass } = publicAccounts[who];
  await page.goto(`${PUBLIC_URL}/#/perfil`);
  await page.getByTestId(ids.publicLoginEmail).fill(email);
  await page.getByTestId(ids.publicLoginPass).fill(pass);
  await page.getByTestId(ids.publicLoginSubmit).click();
  // El form de login desaparece cuando ProfilePage tiene user+token y muestra el email.
  await expect(page.getByTestId(ids.publicLoginSubmit)).toHaveCount(0);
}
