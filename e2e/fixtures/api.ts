import { expect, type APIRequestContext } from '@playwright/test';
import { API_URL } from '../constants';

/** Login vía API para specs que necesitan un access token sin pasar por el
 *  form de UI (ej. para pegarle directo a endpoints de stock/sales). */
export async function login(request: APIRequestContext, user: string, pass: string): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, {
    data: { username: user, password: pass },
  });
  expect(res.ok(), `login ${user} debe responder 2xx`).toBeTruthy();
  const body = (await res.json()) as { access_token: string };
  return body.access_token;
}
