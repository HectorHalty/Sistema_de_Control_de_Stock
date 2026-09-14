# Identidad y login (Proyecto B) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Terminar la identidad de la web pública: botón "Continuar con Google", onboarding "¿jugador o hincha?", vistas personalizadas de jugador/capitán y una vista genérica de torneo — con todo lo de torneo servido desde un adapter mock en el front mientras el admin se reestructura.

**Architecture:** El login (Google/email), la sesión y `completeDni` son reales (2 cambios chicos de backend). Todo lo de torneo (rol efectivo jugador/capitán/seguidor, equipo, partidos, tabla, stats, plantel, torneo genérico) sale de `apps/web-public/src/app/mocks/futbol-identity.ts` detrás de un flag `USE_MOCK_FUTBOL`, accedido siempre por el hook `useFutbolIdentity()`. Los tipos `MeContext` / `CaptainTeamData` / `PublicStandingRow` / `PublicMatchPreview` / `PublicTeamOption` de `public-api.ts` son el contrato estable para el swap futuro.

**Tech Stack:** NestJS + Prisma (Postgres) en `apps/api`; React 19 + Vite + TanStack Query + React Router (HashRouter) + `@react-oauth/google` (ya instalado) en `apps/web-public`. Tests con Vitest (`apps/api`: node + `test/db`; `apps/web-public`: jsdom, **sin** `@testing-library/react`).

**Spec:** [`docs/superpowers/specs/2026-09-09-identidad-login-proyecto-b-design.md`](../specs/2026-09-09-identidad-login-proyecto-b-design.md) — el plan argumenta desde el spec; los ejecutores leen ambos.

## Global Constraints

- Todo el texto visible al usuario va en **español**.
- Login (Google/email), sesión y `completeDni`: **reales y de producción**.
- Todo lo de torneo: **mock en el front** (`USE_MOCK_FUTBOL = true`), no apto para producción hasta el swap. El `rol` que devuelven `login` / `register` / `completeDni` del backend se **ignora** en el front mientras el flag sea `true` — el rol efectivo lo da `resolveMockRole`.
- **DNI: no obligatorio.** Sólo se pide en el paso "jugador" del onboarding. **No hay gate bloqueante.**
- Registro: nombre + email + contraseña. **Sin campo DNI.**
- `VITE_GOOGLE_CLIENT_ID` debe ser idéntico a `GOOGLE_CLIENT_ID`. Sin client id → el botón de Google no se muestra (graceful).
- Anónimo: arma carrito, **no confirma pedidos**, ve el torneo genérico **sin nada resaltado**.
- El onboarding se muestra **una vez** (flag `lch_onboarding_done` en `localStorage`, se limpia en `logout`); siempre re-accesible desde el Perfil.
- Sin cambios de esquema Prisma. Cambios de backend: (a) `email_verified` en `verifyGoogleToken`, (b) `register` sin `dni`.
- No hay `@testing-library/react` en `apps/web-public`: los tests son **sólo sobre funciones puras**.
- Comandos de test: `npm --prefix apps/api test`, `npm --prefix apps/api run test:db`, `npm --prefix apps/web-public test`. Builds: `npm --prefix apps/<app> run build`.
- Cuentas seed (referencia, no se tocan): `capitan@lachacra.test` / `capitan123` / DNI `28123456`; `jugador@lachacra.test` / `jugador123` / DNI `30123456`. Ambas ya tienen `dniConfirmado`.
- Commits en español, terminar con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

### Nuevos archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/web-public/.env.example` | Documentar `VITE_GOOGLE_CLIENT_ID`. |
| `apps/web-public/src/app/components/public/auth/auth-helpers.ts` | Funciones puras: `googleEnabled(clientId?)`, `shouldShowOnboarding(user, dismissed)`. |
| `apps/web-public/src/app/components/public/auth/auth-helpers.test.ts` | Tests de lo anterior. |
| `apps/web-public/src/app/mocks/futbol-identity.ts` | Fixtures + `USE_MOCK_FUTBOL` + `resolveMockRole` / `resolveMockContext` / `resolveMockCaptainTeam` / `listMockTeams` / `mockFollowTeam` / `mockUnfollowTeam` / `mockTorneoPublico`. |
| `apps/web-public/src/app/mocks/futbol-identity.test.ts` | Tests de los resolvers puros. |
| `apps/web-public/src/app/components/public/auth/useFutbolIdentity.ts` | Hook: único punto de integración mock ↔ `publicApi`. |
| `apps/web-public/src/app/components/public/auth/GoogleSignInButton.tsx` | `<GoogleLogin>` → `loginGoogle(credential)`; `null` sin client id. |
| `apps/web-public/src/app/components/public/auth/JugadorDniStep.tsx` | Form de DNI (refactor de `DniModal`), usado en el onboarding y el Perfil. |
| `apps/web-public/src/app/components/public/auth/TeamPicker.tsx` | Buscador + lista de equipos para seguir (extraído de `ProfilePage`). |
| `apps/web-public/src/app/components/public/auth/OnboardingGate.tsx` | Overlay "¿jugador o hincha?" con sus dos caminos. |
| `apps/web-public/src/app/components/public/pages/player-home.ts` | `playerHomeSections(role, meContext)` — qué muestra el Home. |
| `apps/web-public/src/app/components/public/pages/player-home.test.ts` | Tests. |
| `apps/api/test/public-auth-google.test.ts` | `verifyGoogleToken` rechaza `email_verified: false`; `register` sin `dni`. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/api/src/public/dto/public-auth.dto.ts` | `RegisterDto`: quitar `dni`. |
| `apps/api/src/public/public-auth.service.ts` | `verifyGoogleToken`: exigir `email_verified`. `register`: sin `dni`, sin `Persona`. |
| `apps/api/.env.example` | Comentario en `GOOGLE_CLIENT_ID`. |
| `apps/web-public/src/app/api/public-api.ts` | `auth.register` sin `dni`; quitar `captain.getListaBuenaFe`; exportar `PublicRol` ya existe. |
| `apps/web-public/src/app/App.tsx` | Envolver en `<GoogleOAuthProvider>` si hay client id. |
| `apps/web-public/src/app/components/public/auth/PublicAuthContext.tsx` | Quitar `showDniModal`/`setShowDniModal`; rol efectivo + `meContext` desde el adapter; exponer `dniEnPlantelOtroEmail`; limpiar `lch_onboarding_done` en `logout`; `register` sin `dni`. |
| `apps/web-public/src/app/components/public/auth/AuthForm.tsx` | Botón Google + divisor; quitar el input DNI del modo registro. |
| `apps/web-public/src/app/components/public/PublicLayout.tsx` | Montar `<OnboardingGate />`; quitar `<DniModal />`. |
| `apps/web-public/src/app/components/public/CaptainRoute.tsx` | Leer el `rol` efectivo del context. |
| `apps/web-public/src/app/components/public/pages/HomePage.tsx` | Torneo genérico vía `mockTorneoPublico`; secciones personalizadas vía `playerHomeSections` + adapter; quitar `useDemoTorneo`. |
| `apps/web-public/src/app/components/public/pages/ProfilePage.tsx` | Bloque "Mi rendimiento"; sección "Mi vínculo con el torneo"; team picker vía `TeamPicker` + adapter. |
| `apps/web-public/src/app/components/public/pages/CaptainTeamPage.tsx` | Datos vía adapter; alta/edición/baja deshabilitadas con aviso; quitar lista de buena fe. |
| `apps/web-public/src/app/components/public/pages/PaymentPage.tsx` | Copy: "Necesitás una cuenta para confirmar el pedido…". |

### Archivos eliminados

- `apps/web-public/src/app/components/public/auth/DniModal.tsx` (reemplazado por `JugadorDniStep.tsx`).

---

## Interfaces compartidas (contrato entre tareas)

De `apps/web-public/src/app/api/public-api.ts` (ya existen, no cambian de forma):

```ts
export type PublicRol = 'usuario' | 'seguidor' | 'jugador' | 'capitan';

export interface PublicSessionUser {
  id: string; email: string; nombre?: string | null; rol: PublicRol;
  avatarUrl?: string | null; dniConfirmado?: string | null; personaId?: string | null;
  equipoInscripcionId?: string | null; torneoId?: string | null;
  tieneStatsPersonales: boolean; needsDni: boolean;
  puedeSeguirEquipo: boolean; puedeSerCapitan: boolean;
}

export interface MeContext {
  user: PublicSessionUser;
  equipo: { name: string; shortName?: string | null; color?: string | null; categoria?: string } | null;
  proximoPartido: { id: string; fecha: string; hora: string | null; cancha: string | null;
    local: string; visitante: string; esLocal: boolean } | null;
  standingsPosition: unknown;   // el adapter pone un PublicStandingRow | null
  personalStats: { goles: number; amarillas: number; rojas: number; suspensiones: unknown[] } | null;
  tieneStatsPersonales: boolean;
}

export interface PublicStandingRow {
  inscripcionId: string; teamId: string; teamName: string;
  played: number; won: number; drawn: number; lost: number;
  goalsFor: number; goalsAgainst: number; goalDiff: number; points: number;
}

export interface PublicMatchPreview {
  id: string; fecha: string; hora: string | null; cancha: string | null; jornada: number | null;
  local: { id: string; name: string; shortName?: string | null };
  visitante: { id: string; name: string; shortName?: string | null };
}

export interface PublicTeamOption {
  equipoInscripcionId: string; name: string; shortName?: string | null;
  color?: string | null; categoria: string; torneoId: string;
}

export interface CaptainTeamData {
  equipo: { id: string; name: string; shortName?: string | null; color?: string | null;
    categoria: string; maxPlantel: number };
  torneo: { id: string; nombre: string; campeonato: string };
  plantel: RosterPlayer[];
  proximoPartido: { fecha: string; hora: string | null; cancha: string | null; rival: string } | null;
}

export interface RosterPlayer {
  personaId: string; inscripcionId: string; nombre: string; apellido: string;
  dni: string; email: string | null; fechaNacimiento: string | null;
  numeroCamiseta: number | null; rolPlantel: string;
}
```

---

## Task 1: Backend — `register` sin DNI y `email_verified` en Google

**Files:**
- Modify: `apps/api/src/public/dto/public-auth.dto.ts` (`RegisterDto`)
- Modify: `apps/api/src/public/public-auth.service.ts` (`verifyGoogleToken`, `register`)
- Modify: `apps/api/.env.example`
- Test: `apps/api/test/public-auth-google.test.ts` (nuevo), `apps/api/test/public-auth.dto.test.ts` (ajustar)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `RegisterDto` sin `dni` (campos: `email`, `password`, `nombre`).
  - `PublicAuthService.register(dto)` crea `CuentaPublica` con `rol: 'usuario'`, **sin** `Persona`, `personaId` ni `dniConfirmado`.
  - `verifyGoogleToken` lanza `UnauthorizedException` si `payload.email_verified !== true`.

- [ ] **Step 1: Ajustar el test de DTO existente y escribir los nuevos tests**

En `apps/api/test/public-auth.dto.test.ts`, quitar `dni` de los tres payloads de `RegisterDto` (`accepts valid register payload`, `rejects register with short password`, `rejects register with invalid email`).

Crear `apps/api/test/public-auth-google.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';

// Mock google-auth-library ANTES de importar el servicio
const verifyIdToken = vi.fn();
vi.mock('google-auth-library', () => ({
  OAuth2Client: vi.fn().mockImplementation(() => ({ verifyIdToken })),
}));

import { PublicAuthService } from '../src/public/public-auth.service';

function makeService() {
  const prisma = {} as never;
  const jwt = { sign: () => 'tok' } as never;
  const config = {
    get: (k: string) => (k === 'GOOGLE_CLIENT_ID' ? 'client-123' : undefined),
  } as never;
  return new PublicAuthService(prisma, jwt, config);
}

describe('verifyGoogleToken — email verificado', () => {
  it('rechaza un token cuyo email no está verificado', async () => {
    verifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'g-1', email: 'x@gmail.com', email_verified: false, name: 'X' }),
    });
    const svc = makeService();
    // verifyGoogleToken es privado: se ejerce vía loginWithGoogle
    await expect(svc.loginWithGoogle('fake-id-token')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
```

- [ ] **Step 2: Correr los tests — deben fallar**

Run: `npm --prefix apps/api test -- public-auth`
Expected: FALLA — `RegisterDto` todavía exige `dni`; `verifyGoogleToken` no chequea `email_verified`.

- [ ] **Step 3: `RegisterDto` sin `dni`**

En `apps/api/src/public/dto/public-auth.dto.ts`, en `RegisterDto` **borrar** el bloque:

```ts
  @IsString()
  @MinLength(7)
  dni!: string;
```

Queda con `email`, `password`, `nombre`.

- [ ] **Step 4: `register` sin DNI**

En `apps/api/src/public/public-auth.service.ts`, reemplazar el cuerpo de `register`:

```ts
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.cuentaPublica.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Ya existe una cuenta con ese email');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const cuenta = await this.prisma.cuentaPublica.create({
      data: {
        email,
        passwordHash,
        nombre: dto.nombre.trim(),
        rol: 'usuario',
      },
    });

    const session = await this.buildSessionUser(cuenta.id);
    const accessToken = await this.signToken(cuenta.id);
    return { accessToken, user: session };
  }
```

(Se elimina la normalización de DNI, el `persona.upsert`, `resolveAndUpdateRole` y el `splitNombre` sólo si no se usa en otro lado — **verificar**: `grep -n splitNombre apps/api/src/public/public-auth.service.ts`; si sólo lo usaba `register`, borrar el método privado `splitNombre` también.)

- [ ] **Step 5: `email_verified` en `verifyGoogleToken`**

En el mismo archivo, dentro de `verifyGoogleToken`, después del check `if (!payload?.sub || !payload.email)`:

```ts
    if (payload.email_verified !== true) {
      throw new UnauthorizedException('Tu email de Google no está verificado.');
    }
```

- [ ] **Step 6: Comentario en `.env.example`**

En `apps/api/.env.example`, la línea `GOOGLE_CLIENT_ID=` pasa a:

```
# ID de cliente OAuth de Google (web). Debe ser idéntico a VITE_GOOGLE_CLIENT_ID en apps/web-public/.env
GOOGLE_CLIENT_ID=
```

- [ ] **Step 7: Correr los tests — deben pasar**

Run: `npm --prefix apps/api test -- public-auth`
Expected: PASA.

- [ ] **Step 8: Suite completa de API + build**

Run: `npm --prefix apps/api test && npm --prefix apps/api run build`
Expected: PASA (salvo el pre-existente `suspension.engine` "calcula fechas restantes", ajeno a este cambio). Si algún otro test llamaba `auth.register` con `dni` o esperaba una `Persona` tras registrar, ajustarlo — el registro ya no crea `Persona`.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/public/dto/public-auth.dto.ts apps/api/src/public/public-auth.service.ts apps/api/.env.example apps/api/test/public-auth-google.test.ts apps/api/test/public-auth.dto.test.ts
git commit -m "feat(api): registro sin DNI y rechazo de email de Google no verificado"
```

---

## Task 2: Front — `.env.example` y `auth-helpers.ts`

**Files:**
- Create: `apps/web-public/.env.example`
- Create: `apps/web-public/src/app/components/public/auth/auth-helpers.ts`
- Create: `apps/web-public/src/app/components/public/auth/auth-helpers.test.ts`

**Interfaces:**
- Consumes: `PublicSessionUser` de `public-api.ts`.
- Produces:
  - `googleEnabled(clientId?: string | null): boolean` — `true` sólo con string no vacío tras `trim`.
  - `shouldShowOnboarding(user: PublicSessionUser | null, dismissed: boolean): boolean` — `true` si `user` existe, `user.rol === 'usuario'` y `!dismissed`.

- [ ] **Step 1: Escribir los tests**

`apps/web-public/src/app/components/public/auth/auth-helpers.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { googleEnabled, shouldShowOnboarding } from './auth-helpers';
import type { PublicSessionUser } from '../../../api/public-api';

const user = (rol: PublicSessionUser['rol']): PublicSessionUser =>
  ({ id: 'u', email: 'a@b.com', rol, tieneStatsPersonales: false, needsDni: false,
     puedeSeguirEquipo: true, puedeSerCapitan: false } as PublicSessionUser);

describe('googleEnabled', () => {
  it('true sólo con un client id no vacío', () => {
    expect(googleEnabled('abc.apps.googleusercontent.com')).toBe(true);
    expect(googleEnabled('')).toBe(false);
    expect(googleEnabled('   ')).toBe(false);
    expect(googleEnabled(undefined)).toBe(false);
    expect(googleEnabled(null)).toBe(false);
  });
});

describe('shouldShowOnboarding', () => {
  it('true para usuario no descartado', () => {
    expect(shouldShowOnboarding(user('usuario'), false)).toBe(true);
  });
  it('false si ya se descartó', () => {
    expect(shouldShowOnboarding(user('usuario'), true)).toBe(false);
  });
  it('false para roles ya decididos', () => {
    expect(shouldShowOnboarding(user('seguidor'), false)).toBe(false);
    expect(shouldShowOnboarding(user('jugador'), false)).toBe(false);
    expect(shouldShowOnboarding(user('capitan'), false)).toBe(false);
  });
  it('false para anónimo', () => {
    expect(shouldShowOnboarding(null, false)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run: `npm --prefix apps/web-public test -- auth-helpers`
Expected: FALLA (módulo no existe).

- [ ] **Step 3: Escribir `auth-helpers.ts`**

```ts
import type { PublicSessionUser } from '../../../api/public-api';

export function googleEnabled(clientId?: string | null): boolean {
  return typeof clientId === 'string' && clientId.trim().length > 0;
}

export function shouldShowOnboarding(
  user: PublicSessionUser | null,
  dismissed: boolean,
): boolean {
  return !!user && user.rol === 'usuario' && !dismissed;
}
```

- [ ] **Step 4: Crear `apps/web-public/.env.example`**

```
# ID de cliente OAuth de Google (web). Debe ser idéntico a GOOGLE_CLIENT_ID de apps/api.
# Vacío = el botón "Continuar con Google" no se muestra.
VITE_GOOGLE_CLIENT_ID=
```

- [ ] **Step 5: Correr — debe pasar**

Run: `npm --prefix apps/web-public test -- auth-helpers`
Expected: PASA (9 asserts).

- [ ] **Step 6: Commit**

```bash
git add apps/web-public/.env.example apps/web-public/src/app/components/public/auth/auth-helpers.ts apps/web-public/src/app/components/public/auth/auth-helpers.test.ts
git commit -m "feat(web-publica): helpers googleEnabled y shouldShowOnboarding + .env.example"
```

---

## Task 3: Front — adapter mock `futbol-identity.ts`

**Files:**
- Create: `apps/web-public/src/app/mocks/futbol-identity.ts`
- Create: `apps/web-public/src/app/mocks/futbol-identity.test.ts`

**Interfaces:**
- Consumes: `PublicSessionUser`, `PublicRol`, `MeContext`, `CaptainTeamData`, `PublicStandingRow`, `PublicMatchPreview`, `PublicTeamOption`, `RosterPlayer` de `public-api.ts`.
- Produces:

```ts
export const USE_MOCK_FUTBOL = true;

export type MockRoleResult = { rol: PublicRol; dniEnPlantelOtroEmail?: string };

export function resolveMockRole(user: PublicSessionUser): MockRoleResult;
export function resolveMockContext(user: PublicSessionUser): MeContext;
export function resolveMockCaptainTeam(user: PublicSessionUser): CaptainTeamData | null;
export function listMockTeams(search?: string): PublicTeamOption[];
export function mockFollowTeam(user: PublicSessionUser, equipoInscripcionId: string): MeContext;
export function mockUnfollowTeam(user: PublicSessionUser): MeContext;
export function mockTorneoPublico(): {
  torneo: { id: string; nombre: string; categoria: string };
  standings: PublicStandingRow[];
  proximosPartidos: PublicMatchPreview[];
  resultados: { id: string; local: string; visitante: string; golesLocal: number; golesVisitante: number; fecha: string }[];
};
```

- Estado de "equipo seguido": `localStorage` key `lch_mock_followed_team` (guarda el `equipoInscripcionId`).

- [ ] **Step 1: Escribir los tests**

`apps/web-public/src/app/mocks/futbol-identity.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  resolveMockRole, resolveMockContext, mockTorneoPublico, listMockTeams,
} from './futbol-identity';
import type { PublicSessionUser } from '../api/public-api';

const acc = (over: Partial<PublicSessionUser>): PublicSessionUser =>
  ({ id: 'u', email: 'nadie@mail.com', rol: 'usuario', tieneStatsPersonales: false,
     needsDni: true, puedeSeguirEquipo: true, puedeSerCapitan: false, ...over } as PublicSessionUser);

beforeEach(() => localStorage.clear());

describe('resolveMockRole', () => {
  it('sin DNI confirmado → usuario', () => {
    expect(resolveMockRole(acc({ dniConfirmado: null }))).toEqual({ rol: 'usuario' });
  });
  it('email + DNI del jugador fixture → jugador', () => {
    expect(resolveMockRole(acc({ email: 'jugador@lachacra.test', dniConfirmado: '30123456' })))
      .toEqual({ rol: 'jugador' });
  });
  it('email + DNI del capitán fixture → capitan', () => {
    expect(resolveMockRole(acc({ email: 'capitan@lachacra.test', dniConfirmado: '28123456' })))
      .toEqual({ rol: 'capitan' });
  });
  it('DNI en un plantel pero email distinto → usuario + dniEnPlantelOtroEmail', () => {
    const r = resolveMockRole(acc({ email: 'otromail@x.com', dniConfirmado: '27333444' }));
    expect(r.rol).toBe('usuario');
    expect(r.dniEnPlantelOtroEmail).toBe('Los Halcones');
  });
  it('sigue un equipo → seguidor', () => {
    localStorage.setItem('lch_mock_followed_team', 'ei-halcones');
    expect(resolveMockRole(acc({ dniConfirmado: null })).rol).toBe('seguidor');
  });
});

describe('resolveMockContext (jugador fixture)', () => {
  it('devuelve un MeContext con la forma correcta', () => {
    const ctx = resolveMockContext(acc({ email: 'jugador@lachacra.test', dniConfirmado: '30123456' }));
    expect(ctx.equipo?.name).toBe('Los Halcones');
    expect(ctx.proximoPartido).not.toBeNull();
    expect(ctx.standingsPosition).not.toBeNull();
    expect(ctx.personalStats).toMatchObject({ goles: 3, amarillas: 1, rojas: 0 });
    expect(ctx.tieneStatsPersonales).toBe(true);
  });
});

describe('mockTorneoPublico', () => {
  it('tabla no vacía y sin resaltar', () => {
    const t = mockTorneoPublico();
    expect(t.standings.length).toBeGreaterThanOrEqual(4);
    expect(t.proximosPartidos.length).toBeGreaterThan(0);
    expect(t.torneo.nombre).toBeTruthy();
  });
});

describe('listMockTeams', () => {
  it('filtra por nombre', () => {
    expect(listMockTeams('halc').map((x) => x.name)).toContain('Los Halcones');
    expect(listMockTeams('zzz')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run: `npm --prefix apps/web-public test -- futbol-identity`
Expected: FALLA (módulo no existe).

- [ ] **Step 3: Escribir `futbol-identity.ts`**

```ts
import type {
  CaptainTeamData, MeContext, PublicMatchPreview, PublicRol,
  PublicSessionUser, PublicStandingRow, PublicTeamOption, RosterPlayer,
} from '../api/public-api';

export const USE_MOCK_FUTBOL = true;

const FOLLOW_KEY = 'lch_mock_followed_team';

// ---------- Fixtures ----------

const TORNEO = { id: 'trn-apertura', nombre: 'Torneo Apertura', categoria: 'Libre A' };

const TEAMS: PublicTeamOption[] = [
  { equipoInscripcionId: 'ei-halcones', name: 'Los Halcones', shortName: 'HAL', color: '#6BFF9E', categoria: 'Libre A', torneoId: TORNEO.id },
  { equipoInscripcionId: 'ei-depredadores', name: 'Depredadores FC', shortName: 'DEP', color: '#f87171', categoria: 'Libre A', torneoId: TORNEO.id },
  { equipoInscripcionId: 'ei-truenos', name: 'Truenos del Sur', shortName: 'TRU', color: '#60a5fa', categoria: 'Libre A', torneoId: TORNEO.id },
  { equipoInscripcionId: 'ei-tromba', name: 'La Tromba', shortName: 'TRB', color: '#fbbf24', categoria: 'Libre A', torneoId: TORNEO.id },
];

const STANDINGS: PublicStandingRow[] = [
  row('ei-depredadores', 'Depredadores FC', 8, 6, 1, 1, 19, 8),
  row('ei-truenos', 'Truenos del Sur', 8, 5, 2, 1, 16, 9),
  row('ei-halcones', 'Los Halcones', 8, 4, 2, 2, 14, 11),
  row('ei-tromba', 'La Tromba', 8, 3, 2, 3, 12, 13),
  row('ei-ph5', 'Real Potrero', 8, 2, 2, 4, 9, 15),
  row('ei-ph6', 'Sporting Asado', 8, 1, 1, 6, 7, 22),
];

function row(id: string, name: string, pj: number, pg: number, pe: number, pp: number, gf: number, gc: number): PublicStandingRow {
  return {
    inscripcionId: id, teamId: id, teamName: name,
    played: pj, won: pg, drawn: pe, lost: pp,
    goalsFor: gf, goalsAgainst: gc, goalDiff: gf - gc, points: pg * 3 + pe,
  };
}

const PROXIMOS: PublicMatchPreview[] = [
  { id: 'm1', fecha: iso(3), hora: '14:00', cancha: 'Cancha 1', jornada: 9,
    local: { id: 'ei-halcones', name: 'Los Halcones', shortName: 'HAL' },
    visitante: { id: 'ei-depredadores', name: 'Depredadores FC', shortName: 'DEP' } },
  { id: 'm2', fecha: iso(3), hora: '15:30', cancha: 'Cancha 2', jornada: 9,
    local: { id: 'ei-truenos', name: 'Truenos del Sur', shortName: 'TRU' },
    visitante: { id: 'ei-tromba', name: 'La Tromba', shortName: 'TRB' } },
];

const RESULTADOS = [
  { id: 'r1', local: 'Los Halcones', visitante: 'Real Potrero', golesLocal: 3, golesVisitante: 1, fecha: iso(-4) },
  { id: 'r2', local: 'Depredadores FC', visitante: 'Los Halcones', golesLocal: 2, golesVisitante: 2, fecha: iso(-11) },
  { id: 'r3', local: 'La Tromba', visitante: 'Truenos del Sur', golesLocal: 0, golesVisitante: 1, fecha: iso(-11) },
];

function iso(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString();
}

// Roster del capitán (Los Halcones)
const HALCONES_ROSTER: RosterPlayer[] = [
  rp('p-juan', 'Juan', 'Pérez', '30123456', 'jugador@lachacra.test', 10, 'jugador'),
  rp('p-cap', 'Carlos', 'Capitán', '28123456', 'capitan@lachacra.test', 5, 'capitan'),
  rp('p-otro', 'Diego', 'Suárez', '27333444', 'otro.jugador@mail.com', 7, 'jugador'),
  rp('p-4', 'Nicolás', 'Gómez', '31222333', null, 1, 'jugador'),
  rp('p-5', 'Martín', 'Ríos', '32111000', null, 4, 'jugador'),
  rp('p-6', 'Lucas', 'Fernández', '33444555', null, 8, 'jugador'),
  rp('p-7', 'Bruno', 'Acosta', '29888777', null, 9, 'jugador'),
  rp('p-8', 'Pablo', 'Vega', '30999888', null, 11, 'jugador'),
];

function rp(personaId: string, nombre: string, apellido: string, dni: string, email: string | null, camiseta: number, rolPlantel: string): RosterPlayer {
  return { personaId, inscripcionId: `insc-${personaId}`, nombre, apellido, dni, email,
    fechaNacimiento: '1996-04-12', numeroCamiseta: camiseta, rolPlantel };
}

// Jugadores fixture (para resolveMockRole): email de login esperado por DNI
const JUGADOR_FIXTURE = { email: 'jugador@lachacra.test', dni: '30123456', equipo: 'Los Halcones', equipoInscripcionId: 'ei-halcones' };
const CAPITAN_FIXTURE = { email: 'capitan@lachacra.test', dni: '28123456', equipo: 'Los Halcones', equipoInscripcionId: 'ei-halcones' };

// ---------- Resolvers ----------

function getFollowed(): string | null {
  try { return localStorage.getItem(FOLLOW_KEY); } catch { return null; }
}

export function resolveMockRole(user: PublicSessionUser): MockRoleResult {
  const email = user.email.trim().toLowerCase();
  const dni = user.dniConfirmado ?? null;

  if (dni === CAPITAN_FIXTURE.dni && email === CAPITAN_FIXTURE.email) return { rol: 'capitan' };
  if (dni === JUGADOR_FIXTURE.dni && email === JUGADOR_FIXTURE.email) return { rol: 'jugador' };

  if (dni) {
    const rosterHit = HALCONES_ROSTER.find((p) => p.dni === dni);
    if (rosterHit && (rosterHit.email ?? '').toLowerCase() !== email) {
      return { rol: 'usuario', dniEnPlantelOtroEmail: 'Los Halcones' };
    }
  }

  if (getFollowed()) return { rol: 'seguidor' };
  return { rol: 'usuario' };
}

export type MockRoleResult = { rol: PublicRol; dniEnPlantelOtroEmail?: string };

function teamByInscripcion(id: string | null): PublicTeamOption | undefined {
  return id ? TEAMS.find((t) => t.equipoInscripcionId === id) : undefined;
}

function standingFor(id: string): PublicStandingRow | null {
  return STANDINGS.find((s) => s.inscripcionId === id) ?? null;
}

function proximoPara(equipoInscripcionId: string): MeContext['proximoPartido'] {
  const m = PROXIMOS.find((p) => p.local.id === equipoInscripcionId || p.visitante.id === equipoInscripcionId);
  if (!m) return null;
  return {
    id: m.id, fecha: m.fecha, hora: m.hora, cancha: m.cancha,
    local: m.local.name, visitante: m.visitante.name,
    esLocal: m.local.id === equipoInscripcionId,
  };
}

export function resolveMockContext(user: PublicSessionUser): MeContext {
  const { rol } = resolveMockRole(user);
  const base: MeContext = {
    user: { ...user, rol },
    equipo: null, proximoPartido: null, standingsPosition: null,
    personalStats: null, tieneStatsPersonales: rol === 'jugador',
  };

  let equipoInscripcionId: string | null = null;
  if (rol === 'jugador' || rol === 'capitan') equipoInscripcionId = 'ei-halcones';
  else if (rol === 'seguidor') equipoInscripcionId = getFollowed();

  if (equipoInscripcionId) {
    const team = teamByInscripcion(equipoInscripcionId);
    base.equipo = team ? { name: team.name, shortName: team.shortName, color: team.color, categoria: team.categoria } : null;
    base.proximoPartido = proximoPara(equipoInscripcionId);
    base.standingsPosition = standingFor(equipoInscripcionId);
  }

  if (rol === 'jugador') {
    base.personalStats = { goles: 3, amarillas: 1, rojas: 0, suspensiones: [] };
  }

  return base;
}

export function resolveMockCaptainTeam(user: PublicSessionUser): CaptainTeamData | null {
  if (resolveMockRole(user).rol !== 'capitan') return null;
  return {
    equipo: { id: 'ei-halcones', name: 'Los Halcones', shortName: 'HAL', color: '#6BFF9E', categoria: 'Libre A', maxPlantel: 18 },
    torneo: { id: TORNEO.id, nombre: TORNEO.nombre, campeonato: 'Apertura 2026' },
    plantel: HALCONES_ROSTER,
    proximoPartido: { fecha: iso(3), hora: '14:00', cancha: 'Cancha 1', rival: 'Depredadores FC' },
  };
}

export function listMockTeams(search?: string): PublicTeamOption[] {
  const q = (search ?? '').trim().toLowerCase();
  return q ? TEAMS.filter((t) => t.name.toLowerCase().includes(q)) : TEAMS;
}

export function mockFollowTeam(user: PublicSessionUser, equipoInscripcionId: string): MeContext {
  try { localStorage.setItem(FOLLOW_KEY, equipoInscripcionId); } catch { /* noop */ }
  return resolveMockContext(user);
}

export function mockUnfollowTeam(user: PublicSessionUser): MeContext {
  try { localStorage.removeItem(FOLLOW_KEY); } catch { /* noop */ }
  return resolveMockContext(user);
}

export function mockTorneoPublico() {
  return { torneo: TORNEO, standings: STANDINGS, proximosPartidos: PROXIMOS, resultados: RESULTADOS };
}
```

- [ ] **Step 4: Correr — debe pasar**

Run: `npm --prefix apps/web-public test -- futbol-identity`
Expected: PASA.

- [ ] **Step 5: Verificar tipos**

Run: `npm --prefix apps/web-public run build`
Expected: build OK.

- [ ] **Step 6: Commit**

```bash
git add apps/web-public/src/app/mocks/
git commit -m "feat(web-publica): adapter mock de identidad y torneo (futbol-identity)"
```

---

## Task 4: Front — hook `useFutbolIdentity`

**Files:**
- Create: `apps/web-public/src/app/components/public/auth/useFutbolIdentity.ts`

**Interfaces:**
- Consumes: `usePublicAuth()` (`user`), todo lo de `futbol-identity.ts`, `publicApi` (branch real).
- Produces:

```ts
export function useFutbolIdentity(): {
  role: MockRoleResult;
  meContext: MeContext | null;
  getCaptainTeam: () => CaptainTeamData | null;
  listTeams: (search?: string) => PublicTeamOption[];
  followTeam: (equipoInscripcionId: string) => MeContext | null;
  unfollowTeam: () => MeContext | null;
  torneoPublico: () => ReturnType<typeof mockTorneoPublico>;
};
```

- [ ] **Step 1: Escribir el hook**

```ts
import { usePublicAuth } from './PublicAuthContext';
import type { CaptainTeamData, MeContext, PublicTeamOption } from '../../../api/public-api';
import {
  USE_MOCK_FUTBOL, resolveMockRole, resolveMockContext, resolveMockCaptainTeam,
  listMockTeams, mockFollowTeam, mockUnfollowTeam, mockTorneoPublico, type MockRoleResult,
} from '../../../mocks/futbol-identity';

export function useFutbolIdentity() {
  const { user } = usePublicAuth();

  if (USE_MOCK_FUTBOL) {
    const role: MockRoleResult = user ? resolveMockRole(user) : { rol: 'usuario' };
    return {
      role,
      meContext: user ? resolveMockContext(user) : null,
      getCaptainTeam: () => (user ? resolveMockCaptainTeam(user) : null),
      listTeams: (search?: string) => listMockTeams(search),
      followTeam: (id: string) => (user ? mockFollowTeam(user, id) : null),
      unfollowTeam: () => (user ? mockUnfollowTeam(user) : null),
      torneoPublico: () => mockTorneoPublico(),
    };
  }

  // Branch real (desactivado hasta el swap de §7 del spec). Deja el código
  // compilando contra los tipos; NO se ejerce mientras USE_MOCK_FUTBOL sea true.
  throw new Error('useFutbolIdentity: branch real no implementado — ver §7 del spec');
}
```

> Nota para el ejecutor: el branch real se completa en el spec de reestructuración. Que lance en vez de dejar `TODO` es a propósito: si alguien pone `USE_MOCK_FUTBOL = false` sin hacer el swap, falla ruidoso.

- [ ] **Step 2: Verificar tipos**

Run: `npm --prefix apps/web-public run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add apps/web-public/src/app/components/public/auth/useFutbolIdentity.ts
git commit -m "feat(web-publica): hook useFutbolIdentity como unico punto de integracion"
```

---

## Task 5: Front — `PublicAuthContext` sin `showDniModal`, rol/contexto del adapter

**Files:**
- Modify: `apps/web-public/src/app/components/public/auth/PublicAuthContext.tsx`
- Modify: `apps/web-public/src/app/api/public-api.ts` (`auth.register` sin `dni`)

**Interfaces:**
- Consumes: `resolveMockRole`, `resolveMockContext`, `USE_MOCK_FUTBOL`.
- Produces (nuevo shape del context; las tareas siguientes lo usan):

```ts
interface PublicAuthContextValue {
  user: PublicSessionUser | null;          // user.rol = rol EFECTIVO (del adapter en fase mock)
  meContext: MeContext | null;
  token: string | null;
  loading: boolean;
  dniEnPlantelOtroEmail?: string;          // nombre del equipo, o undefined
  onboardingDismissed: boolean;
  dismissOnboarding: () => void;           // setea lch_onboarding_done
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; nombre: string }) => Promise<void>;
  loginDev: (email: string, name: string) => Promise<void>;
  loginGoogle: (idToken: string) => Promise<void>;
  completeDni: (dni: string) => Promise<void>;
  logout: () => void;
  refreshContext: () => Promise<void>;
  applyAuthResponse: (res: AuthResponse) => Promise<void>;
}
```

- **Eliminado:** `showDniModal`, `setShowDniModal`.

- [ ] **Step 1: `public-api.ts` — `register` sin `dni`**

En `apps/web-public/src/app/api/public-api.ts`:

```ts
    register: (data: { email: string; password: string; nombre: string }) =>
      publicFetch<AuthResponse>('/public/auth/register', { method: 'POST', body: data }),
```

- [ ] **Step 2: Reescribir `PublicAuthContext.tsx`**

Cambios concretos:

1. Imports: agregar
   ```ts
   import { USE_MOCK_FUTBOL, resolveMockRole, resolveMockContext } from '../../../mocks/futbol-identity';
   ```
2. Constante y helper local:
   ```ts
   const ONBOARDING_KEY = 'lch_onboarding_done';
   function readDismissed(): boolean {
     try { return localStorage.getItem(ONBOARDING_KEY) === '1'; } catch { return false; }
   }
   ```
3. `useState`: quitar `showDniModal`. Agregar
   ```ts
   const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => readDismissed());
   ```
4. Nuevo helper para derivar el estado efectivo desde un `PublicSessionUser` del backend:
   ```ts
   function applyMock(u: PublicSessionUser): {
     user: PublicSessionUser;
     meContext: MeContext | null;
     dniEnPlantelOtroEmail?: string;
   } {
     if (!USE_MOCK_FUTBOL) return { user: u, meContext: null };
     const { rol, dniEnPlantelOtroEmail } = resolveMockRole(u);
     const effUser = { ...u, rol };
     return {
       user: effUser,
       meContext: resolveMockContext(u),
       dniEnPlantelOtroEmail,
     };
   }
   ```
   Estado nuevo: `const [dniEnPlantelOtroEmail, setDniFlag] = useState<string | undefined>(undefined);`
5. `applyAuthResponse`: reemplazar el cuerpo — ya **no** hay rama `needsDni`/`setShowDniModal`; siempre deriva por `applyMock` (en fase mock no se llama a `publicApi.me.context`):
   ```ts
   const applyAuthResponse = useCallback(async (res: AuthResponse) => {
     publicAuthStorage.setToken(res.accessToken);
     setToken(res.accessToken);
     if (USE_MOCK_FUTBOL) {
       const m = applyMock(res.user);
       setUser(m.user); setMeContext(m.meContext); setDniFlag(m.dniEnPlantelOtroEmail);
       return;
     }
     const ctx = await publicApi.me.context(res.accessToken);
     setMeContext(ctx); setUser(ctx.user);
   }, []);
   ```
6. `refreshContext`: mismo criterio — en fase mock re-deriva desde el `user` que ya tenemos vía `applyMock` (necesita el `user` crudo del backend; guardar aparte `rawUser` o volver a pedir `/public/me/context` sólo para el `user` base). **Decisión:** guardar `const [rawUser, setRawUser] = useState<PublicSessionUser | null>(null)` con el `user` que devuelve el backend, y derivar `user`/`meContext` con `applyMock(rawUser)` en un `useMemo`. Simplifica todo:
   ```ts
   const [rawUser, setRawUser] = useState<PublicSessionUser | null>(null);
   const derived = useMemo(() => (rawUser ? applyMock(rawUser) : null), [rawUser, onboardingDismissed]);
   const user = derived?.user ?? null;
   const meContext = derived?.meContext ?? null;
   const dniEnPlantelOtroEmail = derived?.dniEnPlantelOtroEmail;
   ```
   Y `applyAuthResponse` / el `useEffect` de arranque / `completeDni` sólo setean `rawUser` + `token`. Quitar los `useState` de `user`/`meContext` sueltos.
7. `useEffect` de arranque: en fase mock, tras `publicApi.me.context(token)` para obtener el `user` base (ese endpoint sigue existiendo y devuelve `{ user }` — se usa **sólo** para el `user`, el resto del `MeContext` se ignora en fase mock). Setear `setRawUser(ctx.user)`. En catch, limpiar token.
8. `completeDni`: tras la llamada, `setRawUser(res.user)` + `setToken(res.accessToken)`. Quitar `setShowDniModal(false)` y el `publicApi.me.context` extra.
9. `register`: firma `(data: { email; password; nombre })`.
10. `logout`: agregar
    ```ts
    try { localStorage.removeItem(ONBOARDING_KEY); } catch { /* noop */ }
    setOnboardingDismissed(false);
    setRawUser(null);
    ```
11. Nuevo `dismissOnboarding`:
    ```ts
    const dismissOnboarding = useCallback(() => {
      try { localStorage.setItem(ONBOARDING_KEY, '1'); } catch { /* noop */ }
      setOnboardingDismissed(true);
    }, []);
    ```
12. `value` (useMemo): quitar `showDniModal`/`setShowDniModal`; agregar `dniEnPlantelOtroEmail`, `onboardingDismissed`, `dismissOnboarding`. Actualizar el array de deps.

- [ ] **Step 3: Verificar tipos**

Run: `npm --prefix apps/web-public run build`
Expected: **fallará** en los consumidores de `showDniModal` (`PublicLayout`, `AuthForm` si lo usa) y `register(...,dni)` — se arreglan en Tasks 7, 9. Correr igual para ver el alcance; anotar los archivos que rompen.

> Ruling del ejecutor: es esperable que el build quede rojo hasta Task 9. Si preferís verde por tarea, hacé Tasks 5+7+9 como un solo commit. El plan las separa por claridad de review.

- [ ] **Step 4: Correr tests que no dependan del build**

Run: `npm --prefix apps/web-public test -- auth-helpers futbol-identity`
Expected: PASA (no tocamos esas funciones).

- [ ] **Step 5: Commit**

```bash
git add apps/web-public/src/app/components/public/auth/PublicAuthContext.tsx apps/web-public/src/app/api/public-api.ts
git commit -m "feat(web-publica): rol efectivo y contexto desde el adapter mock; sin DNI gate"
```

---

## Task 6: Front — `GoogleSignInButton` + provider

**Files:**
- Create: `apps/web-public/src/app/components/public/auth/GoogleSignInButton.tsx`
- Modify: `apps/web-public/src/app/App.tsx`

**Interfaces:**
- Consumes: `googleEnabled`, `usePublicAuth().loginGoogle`, `@react-oauth/google` (`GoogleOAuthProvider`, `GoogleLogin`).
- Produces: componente `<GoogleSignInButton />` (default export nombrado); render de `App` envuelto en provider si hay client id.

- [ ] **Step 1: `GoogleSignInButton.tsx`**

```tsx
import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { usePublicAuth } from './PublicAuthContext';
import { googleEnabled } from './auth-helpers';

export function GoogleSignInButton() {
  const { loginGoogle } = usePublicAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!googleEnabled(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)) {
    return null;
  }

  async function handle(credential?: string) {
    if (!credential) {
      setError('No se recibió el token de Google');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await loginGoogle(credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className={loading ? 'pointer-events-none opacity-60' : ''}>
        <GoogleLogin
          theme="filled_black"
          text="continue_with"
          locale="es"
          width="100%"
          onSuccess={(cred) => void handle(cred.credential)}
          onError={() => setError('No se pudo iniciar sesión con Google')}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-center text-xs text-red-300">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: `App.tsx` — provider condicional**

En `apps/web-public/src/app/App.tsx`, importar y envolver:

```tsx
import { GoogleOAuthProvider } from '@react-oauth/google';
import { googleEnabled } from './components/public/auth/auth-helpers';
// ...
function PublicAppShell() {
  // ...useEffect existente sin cambios...
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  const tree = (
    <QueryClientProvider client={queryClient}>
      <PublicAuthProvider>
        <CartProvider>
          <PublicRouter />
        </CartProvider>
      </PublicAuthProvider>
    </QueryClientProvider>
  );

  return googleEnabled(googleClientId)
    ? <GoogleOAuthProvider clientId={googleClientId!}>{tree}</GoogleOAuthProvider>
    : tree;
}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm --prefix apps/web-public run build`
Expected: build compila `GoogleSignInButton` y `App` (el resto puede seguir rojo por Task 5 — anotar sólo errores nuevos de estos dos archivos).

- [ ] **Step 4: Commit**

```bash
git add apps/web-public/src/app/components/public/auth/GoogleSignInButton.tsx apps/web-public/src/app/App.tsx
git commit -m "feat(web-publica): boton Continuar con Google (provider condicional al client id)"
```

---

## Task 7: Front — `AuthForm` con Google y sin DNI

**Files:**
- Modify: `apps/web-public/src/app/components/public/auth/AuthForm.tsx`

**Interfaces:**
- Consumes: `<GoogleSignInButton />`, `googleEnabled`, `usePublicAuth().register` (firma sin `dni`), `login`.
- Produces: nada nuevo.

- [ ] **Step 1: Quitar el estado y la validación de DNI**

En `AuthForm.tsx`:
- Borrar `const [dni, setDni] = useState('');`.
- En `handleSubmit`, en la rama `mode === 'register'`, borrar el bloque:
  ```ts
      if (dni.replace(/\D/g, '').length < 7) {
        setError('Ingresá un DNI válido');
        return;
      }
  ```
- En la llamada `await register({ email, password, nombre, dni });` → `await register({ email, password, nombre });`.
- Borrar el `<input>` de DNI del JSX (el que tiene `placeholder="DNI (sin puntos)"`).

- [ ] **Step 2: Agregar el botón de Google**

Importar:
```ts
import { GoogleSignInButton } from './GoogleSignInButton';
import { googleEnabled } from './auth-helpers';
```

En el JSX, arriba del `<div className="flex gap-2 rounded-xl border ...">` (el toggle Ingresar/Registrarse), insertar:

```tsx
{googleEnabled(import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) && (
  <>
    <GoogleSignInButton />
    <div className="flex items-center gap-3 text-xs text-gray-600">
      <div className="h-px flex-1 bg-[#2a2a2a]" />
      o
      <div className="h-px flex-1 bg-[#2a2a2a]" />
    </div>
  </>
)}
```

- [ ] **Step 3: Verificar tipos**

Run: `npm --prefix apps/web-public run build`
Expected: `AuthForm` compila. (El build global puede seguir rojo por `PublicLayout` → Task 9.)

- [ ] **Step 4: Commit**

```bash
git add apps/web-public/src/app/components/public/auth/AuthForm.tsx
git commit -m "feat(web-publica): AuthForm con Google y registro sin DNI"
```

---

## Task 8: Front — `JugadorDniStep` y `TeamPicker`

**Files:**
- Create: `apps/web-public/src/app/components/public/auth/JugadorDniStep.tsx`
- Create: `apps/web-public/src/app/components/public/auth/TeamPicker.tsx`
- Delete: `apps/web-public/src/app/components/public/auth/DniModal.tsx`

**Interfaces:**
- Consumes: `usePublicAuth().completeDni`, `useFutbolIdentity().listTeams`.
- Produces:
  - `JugadorDniStep({ onDone }: { onDone: () => void }): JSX.Element` — form de DNI; al confirmar llama `completeDni(dni)` y luego `onDone()`.
  - `TeamPicker({ onPick }: { onPick: (equipoInscripcionId: string) => void }): JSX.Element` — buscador + lista; al elegir, `onPick(id)`.

- [ ] **Step 1: `JugadorDniStep.tsx`** (basado en el form de `DniModal.tsx`, sin la carcasa de modal)

```tsx
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { usePublicAuth } from './PublicAuthContext';

export function JugadorDniStep({ onDone }: { onDone: () => void }) {
  const { completeDni } = usePublicAuth();
  const [dni, setDni] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await completeDni(dni.trim());
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el DNI');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-gray-400">
        Ingresá tu DNI para vincularte con tu plantel. Lo usamos sólo para encontrarte en el torneo.
      </p>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={dni}
        onChange={(e) => setDni(e.target.value.replace(/\D/g, '').slice(0, 9))}
        placeholder="DNI sin puntos"
        className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3 text-white outline-none focus:border-lch-accent"
        required
        minLength={7}
      />
      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
      )}
      <button
        type="submit"
        disabled={saving || dni.length < 7}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3 font-black text-[#0e0e0e] disabled:opacity-50"
      >
        {saving ? <Loader2 className="animate-spin" size={18} /> : 'Confirmar'}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: `TeamPicker.tsx`** (extraído de la sección "Seguir un equipo" de `ProfilePage`)

```tsx
import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useFutbolIdentity } from './useFutbolIdentity';

export function TeamPicker({ onPick }: { onPick: (equipoInscripcionId: string) => void }) {
  const { listTeams } = useFutbolIdentity();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  const teams = useMemo(() => listTeams(debounced || undefined), [listTeams, debounced]);

  return (
    <div>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar equipo..."
          className="w-full rounded-xl border border-[#2a2a2a] bg-[#161616] py-2.5 pl-10 pr-4 text-sm outline-none focus:border-lch-accent"
        />
      </div>
      <div className="max-h-56 space-y-2 overflow-y-auto">
        {teams.map((t) => (
          <button
            key={t.equipoInscripcionId}
            type="button"
            onClick={() => onPick(t.equipoInscripcionId)}
            className="flex w-full items-center justify-between rounded-xl border border-[#2a2a2a] bg-[#161616] px-4 py-3 text-left text-sm hover:border-lch-accent/40"
          >
            <span>
              <span className="font-medium">{t.name}</span>
              <span className="ml-2 text-gray-500">{t.categoria}</span>
            </span>
          </button>
        ))}
        {!teams.length && (
          <p className="py-4 text-center text-sm text-gray-500">Sin equipos</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Borrar `DniModal.tsx`**

```bash
git rm apps/web-public/src/app/components/public/auth/DniModal.tsx
```

- [ ] **Step 4: Verificar que no quedan imports de `DniModal`**

Run: `grep -rn "DniModal" apps/web-public/src`
Expected: sólo aparece en `PublicLayout.tsx` (se arregla en Task 9). Si aparece en otro lado, anotarlo.

- [ ] **Step 5: Commit**

```bash
git add apps/web-public/src/app/components/public/auth/JugadorDniStep.tsx apps/web-public/src/app/components/public/auth/TeamPicker.tsx apps/web-public/src/app/components/public/auth/DniModal.tsx
git commit -m "feat(web-publica): JugadorDniStep y TeamPicker reutilizables (baja de DniModal)"
```

---

## Task 9: Front — `OnboardingGate` + montaje en `PublicLayout`

**Files:**
- Create: `apps/web-public/src/app/components/public/auth/OnboardingGate.tsx`
- Modify: `apps/web-public/src/app/components/public/PublicLayout.tsx`

**Interfaces:**
- Consumes: `usePublicAuth()` (`user`, `onboardingDismissed`, `dismissOnboarding`, `dniEnPlantelOtroEmail`), `shouldShowOnboarding`, `<JugadorDniStep>`, `<TeamPicker>`, `useFutbolIdentity().followTeam`.
- Produces: `<OnboardingGate />` — overlay; se auto-oculta cuando `!shouldShowOnboarding(user, onboardingDismissed)`.

- [ ] **Step 1: `OnboardingGate.tsx`**

```tsx
import { useState } from 'react';
import { usePublicAuth } from './PublicAuthContext';
import { shouldShowOnboarding } from './auth-helpers';
import { JugadorDniStep } from './JugadorDniStep';
import { TeamPicker } from './TeamPicker';
import { useFutbolIdentity } from './useFutbolIdentity';

type Step = 'choose' | 'jugador' | 'hincha';

export function OnboardingGate() {
  const { user, onboardingDismissed, dismissOnboarding } = usePublicAuth();
  const { followTeam } = useFutbolIdentity();
  const [step, setStep] = useState<Step>('choose');

  if (!shouldShowOnboarding(user, onboardingDismissed)) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-lch-card p-6">
        {step === 'choose' && (
          <>
            <h2 className="text-lg font-black text-white">¿Sos jugador o hincha?</h2>
            <p className="mt-1 text-sm text-gray-400">
              Elegí cómo querés usar la app. Podés cambiarlo después desde tu perfil.
            </p>
            <div className="mt-5 grid gap-3">
              <button
                type="button"
                onClick={() => setStep('jugador')}
                className="rounded-xl bg-lch-accent py-3 font-black text-[#0e0e0e]"
              >
                Soy jugador
              </button>
              <button
                type="button"
                onClick={() => setStep('hincha')}
                className="rounded-xl border border-[#2a2a2a] bg-[#161616] py-3 font-bold text-white"
              >
                Soy hincha
              </button>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-300"
            >
              Más tarde
            </button>
          </>
        )}

        {step === 'jugador' && (
          <>
            <button type="button" onClick={() => setStep('choose')} className="mb-3 text-xs text-gray-500">
              ← Volver
            </button>
            <h2 className="mb-3 text-lg font-black text-white">Confirmá tu DNI</h2>
            <JugadorDniStep onDone={dismissOnboarding} />
          </>
        )}

        {step === 'hincha' && (
          <>
            <button type="button" onClick={() => setStep('choose')} className="mb-3 text-xs text-gray-500">
              ← Volver
            </button>
            <h2 className="mb-3 text-lg font-black text-white">Elegí tu equipo</h2>
            <TeamPicker
              onPick={(id) => {
                followTeam(id);
                dismissOnboarding();
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
```

> Nota: `dismissOnboarding` cierra el gate en los tres casos. Para "jugador", `completeDni` ya actualizó `rawUser` → `resolveMockRole` recalcula el rol; el gate igual se cierra por el flag. Para "hincha", `followTeam` setea el `localStorage` del adapter y `dismissOnboarding` cierra.

- [ ] **Step 2: `PublicLayout.tsx` — montar el gate, quitar `DniModal`**

- Import: quitar `import { DniModal } from './auth/DniModal';`, agregar `import { OnboardingGate } from './auth/OnboardingGate';`.
- En el JSX, donde hoy está `<DniModal />` (al final del layout), poner `<OnboardingGate />`.
- Si `PublicLayout` usa `showDniModal` del context para algo, borrarlo.

- [ ] **Step 3: Verificar build**

Run: `npm --prefix apps/web-public run build`
Expected: **build verde de vuelta** (Tasks 5+7+9 cierran el círculo). Si algo más rompe, anotarlo.

- [ ] **Step 4: Correr toda la suite de tests del front**

Run: `npm --prefix apps/web-public test`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add apps/web-public/src/app/components/public/auth/OnboardingGate.tsx apps/web-public/src/app/components/public/PublicLayout.tsx
git commit -m "feat(web-publica): onboarding jugador/hincha; baja del DNI modal suelto"
```

---

## Task 10: Front — helper `playerHomeSections`

**Files:**
- Create: `apps/web-public/src/app/components/public/pages/player-home.ts`
- Create: `apps/web-public/src/app/components/public/pages/player-home.test.ts`

**Interfaces:**
- Consumes: `PublicRol`, `MeContext`.
- Produces:

```ts
export function playerHomeSections(
  rol: PublicRol,
  meContext: MeContext | null,
  dniEnPlantelOtroEmail?: string,
): {
  showTorneoGenerico: boolean;   // tabla/partidos/resultados sin resaltar
  showMiProximoPartido: boolean;
  showStatsStrip: boolean;       // sólo jugador
  showEmailMismatch: boolean;
  teamLabel: string | null;      // "Los Halcones · Libre A" | null
  highlightTeamId: string | null;
};
```

Reglas:
- `showTorneoGenerico`: siempre `true` (el torneo se muestra a todos), pero `highlightTeamId` sólo se setea para `seguidor`/`jugador`/`capitan`.
- `showMiProximoPartido`: `rol` in (`seguidor`,`jugador`,`capitan`) **y** `meContext?.proximoPartido != null`.
- `showStatsStrip`: `rol === 'jugador'` **y** `meContext?.personalStats != null`.
- `showEmailMismatch`: `!!dniEnPlantelOtroEmail && rol === 'usuario'`.
- `teamLabel`: si `meContext?.equipo` → `"${name} · ${categoria ?? 'Torneo'}"`, si no `null`.
- `highlightTeamId`: si `rol` in (`seguidor`,`jugador`,`capitan`) y hay `standingsPosition` con `inscripcionId` → ese id; si no `null`.

- [ ] **Step 1: Escribir los tests**

```ts
import { describe, it, expect } from 'vitest';
import { playerHomeSections } from './player-home';
import type { MeContext } from '../../../api/public-api';

const ctxJugador: MeContext = {
  user: {} as never,
  equipo: { name: 'Los Halcones', categoria: 'Libre A' },
  proximoPartido: { id: 'm1', fecha: '2026-09-12', hora: '14:00', cancha: 'C1', local: 'Los Halcones', visitante: 'Depredadores FC', esLocal: true },
  standingsPosition: { inscripcionId: 'ei-halcones', teamName: 'Los Halcones', played: 8, points: 14 } as never,
  personalStats: { goles: 3, amarillas: 1, rojas: 0, suspensiones: [] },
  tieneStatsPersonales: true,
};

describe('playerHomeSections', () => {
  it('anónimo/usuario → torneo genérico sin resaltar, sin stats ni próximo partido', () => {
    const s = playerHomeSections('usuario', null);
    expect(s).toMatchObject({
      showTorneoGenerico: true, showMiProximoPartido: false, showStatsStrip: false,
      showEmailMismatch: false, teamLabel: null, highlightTeamId: null,
    });
  });
  it('usuario con dniEnPlantelOtroEmail → muestra el aviso', () => {
    expect(playerHomeSections('usuario', null, 'Los Halcones').showEmailMismatch).toBe(true);
  });
  it('seguidor → próximo partido + highlight, sin stats', () => {
    const s = playerHomeSections('seguidor', { ...ctxJugador, personalStats: null });
    expect(s.showMiProximoPartido).toBe(true);
    expect(s.showStatsStrip).toBe(false);
    expect(s.highlightTeamId).toBe('ei-halcones');
  });
  it('jugador → todo', () => {
    const s = playerHomeSections('jugador', ctxJugador);
    expect(s).toMatchObject({
      showMiProximoPartido: true, showStatsStrip: true,
      teamLabel: 'Los Halcones · Libre A', highlightTeamId: 'ei-halcones',
    });
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run: `npm --prefix apps/web-public test -- player-home`
Expected: FALLA.

- [ ] **Step 3: Escribir `player-home.ts`**

```ts
import type { MeContext, PublicRol, PublicStandingRow } from '../../../api/public-api';

const TEAM_ROLES: PublicRol[] = ['seguidor', 'jugador', 'capitan'];

export function playerHomeSections(
  rol: PublicRol,
  meContext: MeContext | null,
  dniEnPlantelOtroEmail?: string,
) {
  const hasTeam = TEAM_ROLES.includes(rol);
  const standing = meContext?.standingsPosition as PublicStandingRow | null | undefined;

  return {
    showTorneoGenerico: true,
    showMiProximoPartido: hasTeam && !!meContext?.proximoPartido,
    showStatsStrip: rol === 'jugador' && !!meContext?.personalStats,
    showEmailMismatch: !!dniEnPlantelOtroEmail && rol === 'usuario',
    teamLabel: meContext?.equipo
      ? `${meContext.equipo.name} · ${meContext.equipo.categoria ?? 'Torneo'}`
      : null,
    highlightTeamId: hasTeam && standing?.inscripcionId ? standing.inscripcionId : null,
  };
}
```

- [ ] **Step 4: Correr — debe pasar**

Run: `npm --prefix apps/web-public test -- player-home`
Expected: PASA.

- [ ] **Step 5: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/player-home.ts apps/web-public/src/app/components/public/pages/player-home.test.ts
git commit -m "feat(web-publica): helper playerHomeSections para el Home por rol"
```

---

## Task 11: Front — `HomePage` genérico + personalizado

**Files:**
- Modify: `apps/web-public/src/app/components/public/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `useFutbolIdentity()` (`role`, `meContext`, `torneoPublico`), `usePublicAuth()` (`user`, `dniEnPlantelOtroEmail`), `playerHomeSections`, `mapStandingsFromApi` de `torneo-mappers`.
- Produces: nada nuevo.

- [ ] **Step 1: Reemplazar las fuentes de datos del torneo**

En `HomePage.tsx`:
- Quitar los `useQuery` de `['home-bundle']` y `['torneo-detail', ...]` y todo `useDemoTorneo` / `resolveStandings(..., useDemoTorneo)` / `resolveRecentResults(..., useDemoTorneo)`.
- Traer del adapter:
  ```ts
  const { role, meContext, torneoPublico } = useFutbolIdentity();
  const { user, dniEnPlantelOtroEmail } = usePublicAuth();
  const torneo = useMemo(() => torneoPublico(), [torneoPublico]);
  const sections = playerHomeSections(role.rol, meContext, dniEnPlantelOtroEmail);
  ```
- Tabla de posiciones: `mapStandingsFromApi(torneo.standings)` (ya existe ese mapper). Resaltar la fila cuyo `inscripcionId === sections.highlightTeamId` — hoy el resalte usa `myTeam === row.team` (por nombre); cambiar a comparar por id. `mapStandingsFromApi` no expone el id → **agregar** `inscripcionId` a `UiStandingRow` en `torneo-mappers.ts` y propagarlo en `mapStandingsFromApi` (`inscripcionId: row.inscripcionId`).
- Últimos resultados: `torneo.resultados` (mapear a la forma que ya consume el JSX: `{ id, local, visitante, homeGoals: golesLocal, awayGoals: golesVisitante, date: <formato corto> }`).
- Próximos partidos / "Próximo partido" genérico: `torneo.proximosPartidos[0]` mapeado con `mapNextMatchFromPreview`.

- [ ] **Step 2: Secciones personalizadas**

- **Cabecera:** si `sections.teamLabel`, mostrar el saludo con nombre (`user?.nombre`) + chip `sections.teamLabel`.
- **Card "Mi próximo partido":** renderizar sólo si `sections.showMiProximoPartido`, usando `meContext!.proximoPartido` (local/visitante/cancha/hora + "sos local"/"sos visitante" según `esLocal`).
- **Mini-tira de stats:** renderizar sólo si `sections.showStatsStrip`, 3 números de `meContext!.personalStats` (Goles / Amarillas / Rojas), con link `onClick={() => navigate('/perfil')}` "Ver mi rendimiento". Ubicarla arriba de "Últimos Resultados".
- **Aviso email no coincide:** si `sections.showEmailMismatch`, banner:
  ```tsx
  <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
    Tu DNI figura en el plantel de {dniEnPlantelOtroEmail} con otro email. Pedile al capitán
    que actualice tu email para ver tus estadísticas.
  </div>
  ```
- **CTA anónimo:** si `!user`, un bloque "Iniciá sesión para seguir tu equipo" con `onClick={() => navigate('/perfil')}`.

- [ ] **Step 3: Limpiar imports muertos**

Quitar de `HomePage.tsx` los imports de `resolveRecentResults`, `resolveStandings`, `publicApi` (si ya no se usa), `usePublicAuth`→se sigue usando. `grep` de cada símbolo antes de borrar.

- [ ] **Step 4: `torneo-mappers.ts` — `inscripcionId` en `UiStandingRow`**

```ts
export interface UiStandingRow {
  inscripcionId: string;
  pos: number;
  // ...resto igual
}
// en mapStandingsFromApi:
  return rows.map((row, idx) => ({
    inscripcionId: row.inscripcionId,
    pos: idx + 1,
    // ...resto igual
  }));
```

(`DEMO_STANDINGS` en `demo-torneo.ts` no tiene `inscripcionId` — agregarle uno ficticio a cada fila, ej. `inscripcionId: 'demo-1'`, para que `TorneoPage`/otros consumidores de `resolveStandings` sigan compilando. Verificar consumidores con `grep -rn "resolveStandings\|mapStandingsFromApi" apps/web-public/src`.)

- [ ] **Step 5: Verificar build + tests**

Run: `npm --prefix apps/web-public run build && npm --prefix apps/web-public test`
Expected: build OK; tests PASAN.

- [ ] **Step 6: Verificación en navegador**

```bash
npm --prefix apps/web-public run dev
```
- Anónimo en `/#/`: se ve la tabla de posiciones y próximos partidos, **ninguna fila resaltada**, sin "Mi próximo partido", CTA "Iniciá sesión…".
- Login como `jugador@lachacra.test` / `jugador123` → `/#/`: cabecera con "Los Halcones · Libre A", card "Mi próximo partido", mini-tira 3/1/0, fila de Los Halcones resaltada.

Adjuntar screenshot del Home anónimo y del Home jugador.

- [ ] **Step 7: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/HomePage.tsx apps/web-public/src/app/components/public/torneo-mappers.ts apps/web-public/src/app/components/public/demo-torneo.ts
git commit -m "feat(web-publica): Home generico para todos y personalizado para jugador/seguidor"
```

---

## Task 12: Front — `ProfilePage` "Mi rendimiento" + "Mi vínculo con el torneo"

**Files:**
- Modify: `apps/web-public/src/app/components/public/pages/ProfilePage.tsx`

**Interfaces:**
- Consumes: `useFutbolIdentity()` (`role`, `meContext`, `followTeam`, `unfollowTeam`), `<TeamPicker>`, `<JugadorDniStep>`, `usePublicAuth()` (`user`).
- Produces: nada nuevo.

- [ ] **Step 1: Reemplazar la sección "Seguir un equipo" existente**

Hoy usa `publicApi.teams` / `publicApi.me.followTeam` / `applyAuthResponse` y se muestra si `user.puedeSeguirEquipo`. Reemplazar todo ese `<section>` por una nueva sección **"Mi vínculo con el torneo"**, visible siempre que haya `user`:

```tsx
<section style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-5">
  <h3 className="mb-3 text-sm font-bold text-white">Mi vínculo con el torneo</h3>

  {role.rol === 'jugador' || role.rol === 'capitan' ? (
    <p className="text-sm text-gray-300">
      Estás vinculado como {role.rol === 'capitan' ? 'capitán' : 'jugador'} de{' '}
      <span className="font-bold text-lch-accent">{meContext?.equipo?.name ?? 'tu equipo'}</span>.
    </p>
  ) : role.rol === 'seguidor' ? (
    <div className="space-y-3">
      <p className="text-sm text-gray-300">
        Seguís a <span className="font-bold text-lch-accent">{meContext?.equipo?.name}</span>.
      </p>
      <button type="button" onClick={() => { unfollowTeam(); }} className="text-sm text-red-300 underline">
        Dejar de seguir
      </button>
      <TeamPicker onPick={(id) => { followTeam(id); }} />
    </div>
  ) : (
    <ProfileOnboardingInline />
  )}
</section>
```

`ProfileOnboardingInline` (componente local en el mismo archivo, o reutilizar la lógica de `OnboardingGate` sin el overlay): dos botones "Soy jugador" / "Soy hincha"; jugador → `<JugadorDniStep onDone={() => {}} />` inline; hincha → `<TeamPicker onPick={(id) => followTeam(id)} />`.

> Ruling: para no duplicar, extraer el cuerpo interno de `OnboardingGate` (los tres `step`) a un `<OnboardingBody onClose={...} />` que `OnboardingGate` envuelve con el overlay y `ProfilePage` usa sin overlay. Si el ejecutor lo ve más simple duplicar ~30 líneas, puede hacerlo y anotarlo.

- [ ] **Step 2: Bloque "Mi rendimiento" (sólo jugador)**

Nueva `<section>` visible si `role.rol === 'jugador'`, después del bloque "Próximo Partido" existente y antes de "Datos Personales":

```tsx
{role.rol === 'jugador' && meContext?.personalStats && (
  <section style={{ background: '#1c1c1c', border: '1px solid #2a2a2a' }} className="rounded-2xl p-5">
    <h3 className="mb-4 text-sm font-bold text-white">Mi rendimiento</h3>
    <div className="grid grid-cols-3 gap-3">
      {[
        ['Goles', meContext.personalStats.goles],
        ['Amarillas', meContext.personalStats.amarillas],
        ['Rojas', meContext.personalStats.rojas],
      ].map(([label, n]) => (
        <div key={label} className="rounded-xl bg-[#161616] p-3 text-center">
          <p className="text-2xl font-black text-white">{n}</p>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</p>
        </div>
      ))}
    </div>
    {(() => {
      const st = meContext.standingsPosition as { teamName?: string; played?: number; points?: number } | null;
      return st ? (
        <p className="mt-3 text-xs text-gray-400">
          {meContext.equipo?.name}: {st.played} PJ · {st.points} pts en {/* nombre del torneo */}el Apertura
        </p>
      ) : null;
    })()}
  </section>
)}
```

- [ ] **Step 3: Conectar el bloque "Próximo Partido" y la suspensión al adapter**

- El bloque "Próximo Partido" ya presente en `ProfilePage` (usa `meContext.proximoPartido`) queda igual — ya sale del context, que ahora lo alimenta el adapter.
- El bloque rojo de suspensión (`ctx?.personalStats?.suspensiones?.[0]`) queda igual; el fixture jugador tiene `suspensiones: []` así que no se muestra (correcto).

- [ ] **Step 4: Limpiar**

Quitar de `ProfilePage.tsx`: `teams` state, `search` state, `useEffect` de `publicApi.teams`, `handleFollow`/`handleUnfollow` viejos, imports de `PublicTeamOption` si ya no se usa, `applyAuthResponse` si ya no se usa. `grep` cada símbolo.

- [ ] **Step 5: Verificar build + tests**

Run: `npm --prefix apps/web-public run build && npm --prefix apps/web-public test`
Expected: OK.

- [ ] **Step 6: Verificación en navegador**

Con dev server + API + seed demo:
- Login `jugador@lachacra.test` → `/#/perfil`: bloque "Mi rendimiento" (3/1/0), "Mi vínculo: jugador de Los Halcones".
- Registrar una cuenta nueva → onboarding → "Más tarde" → `/#/perfil`: sección "Mi vínculo" con los dos botones; elegir "Soy hincha" → picker → seguir "Truenos del Sur" → recarga: "Seguís a Truenos del Sur".

Adjuntar screenshot del Perfil jugador.

- [ ] **Step 7: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/ProfilePage.tsx apps/web-public/src/app/components/public/auth/OnboardingGate.tsx
git commit -m "feat(web-publica): Perfil con Mi rendimiento y Mi vinculo con el torneo"
```

---

## Task 13: Front — `CaptainTeamPage` + `CaptainRoute` vía adapter

**Files:**
- Modify: `apps/web-public/src/app/components/public/pages/CaptainTeamPage.tsx`
- Modify: `apps/web-public/src/app/components/public/CaptainRoute.tsx`
- Modify: `apps/web-public/src/app/api/public-api.ts` (quitar `captain.getListaBuenaFe`)

**Interfaces:**
- Consumes: `useFutbolIdentity()` (`role`, `getCaptainTeam`).
- Produces: nada nuevo.

- [ ] **Step 1: `CaptainRoute.tsx` — rol efectivo**

El `user.rol` que expone el context ya es el rol efectivo (Task 5). El componente no cambia de lógica salvo el comentario: la guarda sigue siendo `user.rol !== 'capitan'`. **Verificar** que `loading` sea el del context (sí). Sin cambios funcionales — si ya funciona, dejar como está y anotar "sin cambios".

- [ ] **Step 2: `CaptainTeamPage.tsx` — datos del adapter**

- Quitar `useState<CaptainTeamData | null>` + `loadTeam` que llama `publicApi.captain.getTeam(token)`.
- En su lugar:
  ```ts
  const { role, getCaptainTeam } = useFutbolIdentity();
  const data = getCaptainTeam();
  ```
  (No hay `loading` async; si `data` es `null` y `role.rol !== 'capitan'`, la `CaptainRoute` ya redirigió — igual mostrar un fallback defensivo.)
- Quitar `error` state si sólo lo seteaba `loadTeam`.

- [ ] **Step 3: Deshabilitar mutaciones**

- Los handlers `handleAdd`, `handleSaveEdit`, `handleRemove` → reemplazar el cuerpo por:
  ```ts
  window.alert('La edición del plantel va a estar disponible cuando se conecte el torneo.');
  ```
  o mejor, un estado `const [mutDisabledNote] = useState(true)` y deshabilitar los botones "Agregar jugador" / "Editar" / eliminar con `disabled` + `title="Disponible cuando se conecte el torneo"`, y un aviso visible una vez:
  ```tsx
  <p className="rounded-lg border border-[#2a2a2a] bg-[#161616] px-3 py-2 text-xs text-gray-400">
    La edición del plantel está deshabilitada hasta que se conecte el torneo. Podés ver el plantel actual.
  </p>
  ```
- La tabla del plantel (`data.plantel.map(...)`) se muestra completa (nombre, apellido, dni, camiseta, rol).

- [ ] **Step 4: Quitar la lista de buena fe**

- En `CaptainTeamPage.tsx`: borrar `handlePrintListaBuenaFe`, la llamada `publicApi.captain.getListaBuenaFe(token)`, y el botón que la dispara.
- En `apps/web-public/src/app/api/public-api.ts`: borrar del objeto `captain` la línea `getListaBuenaFe: (token: string) => publicFetch<string>('/public/captain/roster/lista-buena-fe', { token }),`.

- [ ] **Step 5: Verificar**

Run: `grep -rn "getListaBuenaFe\|lista-buena-fe\|ListaBuenaFe" apps/web-public/src`
Expected: sin resultados.

Run: `npm --prefix apps/web-public run build && npm --prefix apps/web-public test`
Expected: OK.

- [ ] **Step 6: Verificación en navegador**

Login `capitan@lachacra.test` / `capitan123` → `/#/administrar-equipo`: se ve el plantel de Los Halcones (8 jugadores); "Agregar jugador" y "Editar" deshabilitados con el aviso; no hay botón de lista de buena fe.

Adjuntar screenshot.

- [ ] **Step 7: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/CaptainTeamPage.tsx apps/web-public/src/app/components/public/CaptainRoute.tsx apps/web-public/src/app/api/public-api.ts
git commit -m "feat(web-publica): panel de capitan vía adapter, mutaciones deshabilitadas, sin lista de buena fe"
```

---

## Task 14: Front — copy de cantina anónima + verificación integral

**Files:**
- Modify: `apps/web-public/src/app/components/public/pages/PaymentPage.tsx`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada.

- [ ] **Step 1: Copy en `PaymentPage`**

En el bloque `{!user ? (...)}` de `PaymentPage.tsx` (el que muestra `<AuthForm />`), el texto actual:

```
Iniciá sesión o registrate para confirmar el pedido y obtener tu código QR de retiro.
```

cambiar a:

```
Necesitás una cuenta para confirmar el pedido y recibir tu código QR de retiro. Podés
armar el carrito sin registrarte.
```

- [ ] **Step 2: Build + suites completas**

Run:
```bash
npm --prefix apps/web-public run build && npm --prefix apps/web-public test && npm --prefix apps/api test
```
Expected: todo PASA (salvo el pre-existente `suspension.engine`).

- [ ] **Step 3: Verificación en navegador — recorrido completo**

Con `apps/api` (seed demo) + `apps/web-public` corriendo:

1. **Anónimo:** `/#/` muestra torneo genérico sin resaltar. `/#/cantina` → agregar ítems → `/#/carrito` OK → `/#/pago` muestra `AuthForm` con el copy nuevo, no deja confirmar.
2. **Registro nuevo:** crear cuenta (nombre + email + password, sin DNI) → aparece "¿Sos jugador o hincha?".
   - "Más tarde" → entra como `usuario`, Home genérico. `/#/perfil` → "Mi vínculo" con los dos botones.
3. **Camino hincha:** desde el Perfil, "Soy hincha" → elegir "Depredadores FC" → `/#/` muestra "Depredadores FC" resaltado + su próximo partido, sin stats.
4. **Camino jugador:** logout, login `jugador@lachacra.test` (ya tiene DNI `30123456`) → Home personalizado + `/#/perfil` "Mi rendimiento".
5. **Email no coincide:** registrar cuenta con email cualquiera → onboarding "Soy jugador" → DNI `27333444` → queda `usuario`, Home muestra el banner "Tu DNI figura en el plantel de Los Halcones con otro email…".
6. **Capitán:** login `capitan@lachacra.test` → `/#/administrar-equipo` plantel visible, edición deshabilitada, sin lista de buena fe.
7. **Google:** si hay `VITE_GOOGLE_CLIENT_ID` seteado, el botón aparece en `AuthForm`; si no, no aparece y el resto funciona.

Adjuntar screenshots de: Home anónimo, onboarding, Home jugador, banner email-mismatch, panel capitán.

- [ ] **Step 4: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/PaymentPage.tsx
git commit -m "feat(web-publica): copy de cantina para anonimo (arma carrito, no confirma)"
```

---

## Self-Review

**1. Cobertura del spec:**

| Requisito del spec | Task |
|---|---|
| `verifyGoogleToken` exige `email_verified` | 1 |
| `register` sin DNI (DTO + service + sin Persona) | 1 |
| `.env.example` API + web-public, `VITE_GOOGLE_CLIENT_ID` | 1, 2 |
| `googleEnabled`, `shouldShowOnboarding` + tests | 2 |
| Adapter mock: fixtures, `resolveMockRole` (regla email+DNI), `resolveMockContext`, captain, teams, follow, `mockTorneoPublico`, `USE_MOCK_FUTBOL` | 3 |
| `useFutbolIdentity` único punto de integración | 4 |
| `PublicAuthContext`: sin `showDniModal`, rol efectivo del adapter, `dniEnPlantelOtroEmail`, limpiar flag en logout | 5 |
| `GoogleSignInButton` + provider condicional | 6 |
| `AuthForm`: Google + divisor + sin DNI en registro | 7 |
| `JugadorDniStep` (de `DniModal`), `TeamPicker` reutilizable, baja de `DniModal` | 8 |
| `OnboardingGate` (jugador/hincha/más tarde) + montaje en `PublicLayout` | 9 |
| `playerHomeSections` + test | 10 |
| Home genérico (sin resaltar, sin "mi próximo partido") + personalizado + quitar `useDemoTorneo` | 11 |
| Perfil: "Mi rendimiento" + "Mi vínculo con el torneo" + team picker vía adapter | 12 |
| Capitán vía adapter, mutaciones deshabilitadas, sin lista de buena fe (front + `public-api`) | 13 |
| `CaptainRoute` rol efectivo | 13 |
| Cantina anónima: arma carrito, no confirma, copy | 14 |
| Tabla de roles (§ "Roles y qué puede hacer cada uno") | 11, 12, 13, 14 (comportamiento) |
| Tests: `email_verified`, `register` sin dni, `resolveMockRole` (5), `resolveMockContext`, `mockTorneoPublico`, `googleEnabled`, `shouldShowOnboarding`, `playerHomeSections` | 1, 2, 3, 10 |
| §7 contrato de integración futura | documentado en el spec; `useFutbolIdentity` branch real lanza a propósito (Task 4) |

Sin gaps. El endpoint backend `/public/captain/roster/lista-buena-fe` **no** se elimina (el spec lo difiere a la reestructuración) — sólo se saca del front.

**2. Placeholder scan:** Cada step de código tiene el bloque real. Las tres "Notas/Rulings para el ejecutor" (build rojo transitorio entre Tasks 5–9; branch real de `useFutbolIdentity` que lanza; extraer `OnboardingBody` vs duplicar) son decisiones acotadas con la opción por defecto indicada, no trabajo sin especificar.

**3. Consistencia de tipos:**
- `MockRoleResult { rol; dniEnPlantelOtroEmail? }` — igual en Task 3 (definición), 4 (`role`), 5 (`resolveMockRole`), 10 (`playerHomeSections` recibe `rol` + flag por separado).
- `useFutbolIdentity()` devuelve `{ role, meContext, getCaptainTeam, listTeams, followTeam, unfollowTeam, torneoPublico }` — mismos nombres en Tasks 4, 8 (`listTeams`), 9 (`followTeam`), 11 (`torneoPublico`, `meContext`, `role`), 12 (`followTeam`, `unfollowTeam`), 13 (`getCaptainTeam`).
- `PublicAuthContext` nuevo shape: `dniEnPlantelOtroEmail`, `onboardingDismissed`, `dismissOnboarding` — definidos en Task 5, consumidos en 9 (`onboardingDismissed`, `dismissOnboarding`), 11 (`dniEnPlantelOtroEmail`).
- `register(data: { email; password; nombre })` — Task 1 (DTO), 5 (`public-api` + context), 7 (`AuthForm` la llama).
- `playerHomeSections(rol, meContext, dniEnPlantelOtroEmail?)` → objeto con `showTorneoGenerico`, `showMiProximoPartido`, `showStatsStrip`, `showEmailMismatch`, `teamLabel`, `highlightTeamId` — Task 10 (def + test), 11 (consumo).
- `UiStandingRow.inscripcionId` — agregado en Task 11, usado en el mismo Task para el resalte.

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-09-identidad-login-proyecto-b.md`. Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — despacho un subagente fresco por tarea, reviso entre tareas, iteración rápida.

**2. Inline Execution** — ejecuto las tareas en esta sesión con checkpoints de review por lote.

¿Cuál preferís?
