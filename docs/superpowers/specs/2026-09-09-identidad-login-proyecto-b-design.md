# Identidad y login — Proyecto B — Diseño

**Fecha:** 2026-09-09
**Proyecto:** B (identidad del hincha/jugador/capitán, sin tocar el modelo de torneo)
**Estado:** aprobado para planificación

## Problema

El backend de identidad ya está construido: Google OAuth, email/contraseña, vínculo
DNI → `Persona`, resolución de rol (`usuario` → `seguidor` → `jugador` → `capitan`),
gestión de plantel del capitán, y contexto personal del jugador (goles, tarjetas,
suspensiones, próximo partido, posición en la tabla). Lo que falta es:

- No hay botón de "Continuar con Google" en la web pública, aunque `loginGoogle` está
  cableado en el `PublicAuthContext`, `publicApi.auth.loginGoogle` existe, y
  `@react-oauth/google` ya es dependencia de `apps/web-public`.
- El DNI es opcional: el `DniModal` se cierra con la X o clic afuera. El acuerdo de
  Proyecto B es DNI **obligatorio**.
- Cualquiera que tipee un DNI que figure en un plantel obtiene el rol `jugador` y ve
  las estadísticas de esa persona. No hay verificación de que el DNI sea tuyo.
- La experiencia "soy jugador, veo lo mío" está a medias: el Home intenta mostrar "mi
  próximo partido" y "mi equipo" pero no lo completa; el Perfil sólo muestra la
  suspensión activa, no el resto de las stats.

Además, **el lado admin del torneo se va a reestructurar**. Construir las vistas de
jugador/capitán contra `PublicMeService.getMeContext` y `PublicCaptainService` reales
(que leen `Torneo`, `PartidoFutbol`, `InscripcionJugador`, `CapitanAutorizado` y el
motor de reglamento) sería construir sobre un blanco móvil.

## Decisión de alcance: qué es real y qué es mock

| Área | Tratamiento |
|---|---|
| Login con Google (web), login email/contraseña, registro | **Real y definitivo.** |
| Sesión: JWT en `localStorage`, `PublicAuthContext`, Bearer token | **Real y definitivo.** |
| DNI obligatorio (gate), creación de `CuentaPublica` / `Persona`, `completeDni` | **Real y definitivo.** |
| Chequeo `email_verified` del ID token de Google | **Real** (único cambio de backend). |
| Rol efectivo jugador/capitán, regla email+DNI | **Mock en el front** (fase actual). |
| Mi equipo, mi próximo partido, tabla de posiciones, mi fila | **Mock en el front.** |
| Stats del jugador (goles/amarillas/rojas/suspensiones) | **Mock en el front.** |
| Plantel del capitán (ver) | **Mock en el front** (read-only en esta fase). |
| Plantel del capitán (alta/edición/baja) | **Deshabilitado** con aviso; se reactiva post-reestructuración. |
| Lista de buena fe | **Fuera de alcance** de la web de clientes (es solo admin). |

**Constraint global:** este build **no es apto para producción del lado torneo** hasta
que el adapter mock se reemplace por llamadas reales (ver §7). El login, la sesión y el
DNI sí son de producción.

## Fuera de alcance (explícito)

- Cualquier cambio al modelo de torneo (`Torneo`, `PartidoFutbol`, `InscripcionJugador`,
  `CapitanAutorizado`, `EquipoInscripcion`, motor de reglamento) — eso es la
  reestructuración del admin, su propio spec.
- Google Sign-In en la app Capacitor (Android/iOS). Sólo web por ahora.
- One Tap / prompt automático de Google. Sólo el botón explícito.
- Cola de aprobación de identidad en el panel admin.
- "Ver la lista de jugadores al clickear un equipo" en la página de torneo — feature de
  la página de torneo, va en el spec de reestructuración.
- Impresión de lista de buena fe desde la web de clientes — es solo admin.
- Migrar la regla email+DNI al backend — se hace cuando llegue la reestructuración.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plataformas del login Google | Solo web. GSI (`gsi/client` vía `@react-oauth/google`). |
| Verificación de que el DNI es tuyo | Match `cuenta.email` == `persona.email` de la inscripción (y el DNI). Sin match → `usuario` + mensaje "avisá al capitán". |
| DNI obligatorio | Siempre, desde la creación de la cuenta. Gate bloqueante, única salida: cerrar sesión. |
| Email de Google no coincide con el plantel | La cuenta **no** se vincula. Mensaje: "Tu DNI figura en el plantel de <equipo> con otro email. Pedile al capitán que actualice tu email." El capitán ya puede editar ese email desde su panel (post-reestructuración). Cero UI de admin nueva. |
| Vista del jugador | Home personalizado (mi próximo partido, mi equipo, mini-tira de stats, mi fila en la tabla) + bloque "Mi rendimiento" en el Perfil. Sin ruta nueva. |
| Vista del capitán | `CaptainTeamPage` ya está completa. Se conecta al adapter; mutaciones deshabilitadas en fase mock. |
| One Tap | No se usa. |
| Nonce en el ID token | No. Tradeoff aceptado (token de ~1h, audience-bound, verificado server-side). |

## Arquitectura

**Principio:** el Proyecto B es ~80% backend ya hecho. Este spec **termina el frontend**
y agrega **un chequeo de seguridad** (`email_verified`) en el backend. Sin modelos
nuevos, sin cambios de esquema Prisma.

```text
Login (real)
  <GoogleLogin> → credential (ID token JWT)
    POST /public/auth/google → verifyGoogleToken (firma + iss + aud + exp + email_verified)
      → upsertAndSign → { accessToken, user }
  AuthForm (email/pass) → POST /public/auth/login | /register  [sin cambios]

DNI gate (real)
  user.needsDni → DniGate a pantalla completa (no cerrable) → completeDni → needsDni=false

Contexto de fútbol (mock en esta fase)
  useFutbolIdentity()
    USE_MOCK_FUTBOL=true  → adapter mocks/futbol-identity.ts (fixtures)
    USE_MOCK_FUTBOL=false → publicApi.me.context / publicApi.captain.getTeam  [branch ya escrito, desactivado]
```

### Unidades

| Unidad | Hace | Se usa en | Depende de |
|---|---|---|---|
| `verifyGoogleToken` (editado) | Valida el ID token; ahora exige `email_verified === true` | `PublicAuthService.loginWithGoogle` | `google-auth-library`, `GOOGLE_CLIENT_ID` |
| `googleEnabled(clientId?)` | `true` sólo con string no vacío | root del front, `GoogleSignInButton` | — |
| `GoogleSignInButton` | Renderiza `<GoogleLogin>`; `onSuccess` → `loginGoogle(credential)`; `null` sin provider | `AuthForm` | `@react-oauth/google`, `PublicAuthContext` |
| `needsDniGate(user)` | `!!user && !user.dniConfirmado` | `PublicLayout` | — |
| `DniGate` (refactor de `DniModal`) | Bloquea toda la app hasta que haya DNI | `PublicLayout` | `PublicAuthContext` |
| `futbol-identity.ts` (adapter mock) | Resuelve rol + contexto + plantel desde fixtures | `useFutbolIdentity`, `PublicAuthContext` | tipos `MeContext` / `CaptainTeamData` |
| `useFutbolIdentity()` | Único punto de integración: mock o `publicApi` según el flag | Home, Perfil, CaptainTeamPage, PublicRouter | `futbol-identity.ts`, `publicApi` |
| `playerHomeSections(ctx)` | Qué secciones muestra el Home del jugador | `HomePage` | — |

## 1. Backend (mínimo)

### `verifyGoogleToken` — exigir email verificado

En `apps/api/src/public/public-auth.service.ts`, dentro de `verifyGoogleToken`, después
de validar `payload?.sub` y `payload.email`:

```ts
if (payload.email_verified !== true) {
  throw new UnauthorizedException('Tu email de Google no está verificado.');
}
```

Nada más cambia en el backend. `resolveAndUpdateRole`, `getMeContext`,
`PublicCaptainService`, DTOs y esquema quedan igual. El `rol` que devuelven
`login` / `register` / `completeDni` **se ignora en el front durante la fase mock**.

### Config de entorno

- `apps/api/.env.example`: ya tiene `GOOGLE_CLIENT_ID=` (placeholder). Agregar comentario:
  `# Mismo valor que VITE_GOOGLE_CLIENT_ID en apps/web-public/.env`.
- Crear `apps/web-public/.env.example` con:
  ```
  # ID de cliente OAuth de Google (web). Debe ser idéntico a GOOGLE_CLIENT_ID de apps/api.
  # Vacío = el botón "Continuar con Google" no se muestra.
  VITE_GOOGLE_CLIENT_ID=
  ```
- El `.env` real lo completa el operador con el client id de la consola de Google.

## 2. Google Sign-In (web)

### Provider

`apps/web-public/src/app/main.tsx` (o el componente raíz que monta `PublicRouter`):

```tsx
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
// ...
googleEnabled(googleClientId)
  ? <GoogleOAuthProvider clientId={googleClientId!}>{app}</GoogleOAuthProvider>
  : app
```

Sin client id → el provider no se monta → el script `accounts.google.com/gsi/client`
no se inyecta.

### `GoogleSignInButton.tsx`

`apps/web-public/src/app/components/public/auth/GoogleSignInButton.tsx`:

- Lee `VITE_GOOGLE_CLIENT_ID`; si `!googleEnabled(...)` → `return null`.
- Renderiza `<GoogleLogin theme="filled_black" text="continue_with" locale="es"
  onSuccess={handle} onError={() => setError('No se pudo iniciar sesión con Google')} />`.
- `handle(cred)`: si `!cred.credential` → error; si no, `setLoading(true)` →
  `await loginGoogle(cred.credential)` → en catch, `setError(mensaje en español)` →
  `finally setLoading(false)`.
- Estados locales `loading` / `error`. Mientras `loading`, overlay o `pointer-events:none`
  sobre el botón. `error` se muestra abajo, en rojo.

### `AuthForm.tsx`

Arriba del toggle Ingresar/Registrarse:

```tsx
<GoogleSignInButton />
<div className="flex items-center gap-3 text-xs text-gray-600">
  <div className="h-px flex-1 bg-[#2a2a2a]" /> o <div className="h-px flex-1 bg-[#2a2a2a]" />
</div>
```

Aparece en modo `login` y `register`. Si `GoogleSignInButton` devuelve `null`, el
divisor también se oculta (renderizar ambos condicionalmente a `googleEnabled`).

Tras `loginGoogle` exitoso: `PublicAuthContext` ya llama a `applyAuthResponse`; si
`user.needsDni`, el `DniGate` de §3 toma el control. Sin lógica extra en `AuthForm`.

### Seguridad (registrada)

| Riesgo | Mitigación |
|---|---|
| Token falsificado / de otra app | `verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID })` valida firma + `aud` + `iss` + `exp`. Falla cerrada. |
| Email de Google sin verificar | `email_verified === true` obligatorio (§1). |
| `aud` desalineado front/API | `VITE_GOOGLE_CLIENT_ID` === `GOOGLE_CLIENT_ID`; documentado en ambos `.env.example`. Divergencia → verificación rechaza, sin fallback. |
| Linking por email a cuenta existente | Seguro: sólo tras verificar el ID token y `email_verified`; requiere controlar esa cuenta de Google. |
| Token en logs | El `credential` nunca se loguea. Viaja sólo en el body POST sobre HTTPS. |
| Replay del ID token | Tradeoff aceptado: token ~1h, audience-bound, verificado server-side. Sin nonce. |
| One Tap / cookies de terceros | No se usa One Tap. Sólo botón explícito. |

### Eficiencia (registrada)

- Sin client id → sin provider → sin script.
- `GoogleOAuthProvider` en el root sólo si hay client id; el script de Google carga
  async, no bloquea el render, lo cachea el CDN de Google.
- `loginGoogle` ya está `useCallback`-eado; `meContext` se pide una vez por cambio de
  sesión, no por render. GSI es event-driven, sin polling.
- `<GoogleLogin>` usa el botón nativo de Google (sin CSS custom).
- Scopear el provider al montaje del `AuthForm` queda anotado como mejora futura (YAGNI).

## 3. DNI obligatorio (gate)

### Comportamiento

`DniModal` deja de ser un modal cerrable y pasa a `DniGate` bloqueante:

- `PublicAuthContext`: exponer `dniRequired = !!user && !user.dniConfirmado` (helper
  `needsDniGate(user)`). Eliminar `showDniModal` / `setShowDniModal` y la lógica de
  "mostrar el modal" — el gate es derivado del estado del usuario, no un flag imperativo.
- `PublicLayout`: si `dniRequired`, renderizar **sólo** `<DniGate />` a pantalla
  completa. Nada de sidebar, header, nav, ni `<Outlet />`.
- `DniGate` (renombrar/refactor de `DniModal`):
  - Reusa el form actual (input DNI numérico, `completeDni`).
  - **Sin** botón X, sin `Escape`, sin cerrar al clic afuera.
  - Copy: "Necesitamos tu DNI para vincularte con el torneo y la cantina. Es
    obligatorio para usar tu cuenta."
  - Única salida: botón "Cerrar sesión" → `logout()`.
  - `completeDni` exitoso → `dniConfirmado` se setea → `dniRequired` pasa a `false` →
    el gate desaparece y aparece la app.
- Registro email/password: ya exige DNI en el form, no cambia.
- Login Google de una cuenta que **ya** tiene `dniConfirmado`: entra directo, sin gate.

### Helper + test

`needsDniGate(user: PublicSessionUser | null): boolean` → `!!user && !user.dniConfirmado`.

## 4. Adapter mock de identidad de fútbol

`apps/web-public/src/app/mocks/futbol-identity.ts`. Los tipos `MeContext`,
`CaptainTeamData`, `PublicStandingRow`, `PublicTeamOption` de
`apps/web-public/src/app/api/public-api.ts` son el **contrato estable**; el adapter los
respeta al pie de la letra.

### Fixtures (constantes en el archivo)

- **Torneo:** "Torneo Apertura — Libre A" (id ficticio).
- **Equipos:** "Los Halcones" y "Depredadores FC" (+ ~4 nombres más sólo para la tabla).
- **Tabla de posiciones:** ~6 filas `PublicStandingRow` con datos coherentes (PJ, PG,
  PE, PP, GF, GC, DG, Pts). "Los Halcones" en una posición media.
- **Jugador ficticio:** email `jugador@lachacra.test`, DNI `30111222`, equipo "Los
  Halcones", stats `{ goles: 3, amarillas: 1, rojas: 0, suspensiones: [] }`, próximo
  partido vs "Depredadores FC" (local), fila en la tabla.
- **Capitán ficticio:** email `capitan@lachacra.test`, DNI `28999111`, equipo "Los
  Halcones", plantel de ~8 jugadores (`RosterPlayer[]` con nombre, apellido, dni,
  camiseta, `rolPlantel`).
- **Caso email no coincide:** el DNI `30111222` también figura en el fixture del plantel
  con email `jugador.viejo@mail.com`. Si la cuenta logueada tiene `dniConfirmado ===
  '30111222'` pero `email !== 'jugador@lachacra.test'`, el adapter devuelve
  `rol: 'usuario'` + `dniEnPlantelOtroEmail: 'Los Halcones'`.

### API del adapter

```ts
export const USE_MOCK_FUTBOL = true; // flip a false cuando el admin exponga los endpoints reales

export type MockRoleResult = {
  rol: PublicRol;                    // 'usuario' | 'seguidor' | 'jugador' | 'capitan'
  dniEnPlantelOtroEmail?: string;    // nombre del equipo, para el mensaje
};

export function resolveMockRole(user: PublicSessionUser): MockRoleResult;
export function resolveMockContext(user: PublicSessionUser): MeContext;
export function resolveMockCaptainTeam(user: PublicSessionUser): CaptainTeamData;
export function listMockTeams(search?: string): PublicTeamOption[];
export function mockFollowTeam(user: PublicSessionUser, equipoInscripcionId: string): MeContext;
export function mockUnfollowTeam(user: PublicSessionUser): MeContext;
```

**Regla de `resolveMockRole`:**
1. Sin `dniConfirmado` → `{ rol: 'usuario' }`.
2. `email` + `dni` matchean el fixture capitán → `{ rol: 'capitan' }`.
3. `email` + `dni` matchean el fixture jugador → `{ rol: 'jugador' }`.
4. `dni` matchea un plantel pero `email` no → `{ rol: 'usuario', dniEnPlantelOtroEmail: <equipo> }`.
5. La cuenta eligió seguir un equipo (estado local, ver abajo) → `{ rol: 'seguidor' }`.
6. Si no → `{ rol: 'usuario' }`.

**Seguir equipo (mock):** `mockFollowTeam` / `mockUnfollowTeam` guardan
`{ equipoInscripcionId }` en `localStorage` (`lch_mock_followed_team`) y devuelven un
`MeContext` armado desde el fixture del equipo elegido. Sólo para roles no jugador/capitán.

**Plantel del capitán:** `resolveMockCaptainTeam` devuelve el fixture completo. Las
mutaciones (`addPlayer` / `updatePlayer` / `removePlayer`) **no** se implementan en el
adapter; la UI las deshabilita (§5c).

### `useFutbolIdentity()`

`apps/web-public/src/app/components/public/auth/useFutbolIdentity.ts` (o junto al
adapter). Único punto de integración:

```ts
export function useFutbolIdentity() {
  const { user } = usePublicAuth();
  if (USE_MOCK_FUTBOL) {
    return {
      role: user ? resolveMockRole(user) : { rol: 'usuario' as const },
      meContext: user ? resolveMockContext(user) : null,
      captainTeam: () => user ? resolveMockCaptainTeam(user) : null,
      teams: (s?: string) => listMockTeams(s),
      followTeam: (id: string) => user && mockFollowTeam(user, id),
      unfollowTeam: () => user && mockUnfollowTeam(user),
    };
  }
  // branch real (desactivado): publicApi.me.context / publicApi.captain.getTeam / ...
}
```

### `PublicAuthContext`

Hoy hace `publicApi.me.context()` para `meContext` y usa `user.rol` del backend.
Cambios:

- El `rol` efectivo del `user` expuesto por el context se sobreescribe con
  `resolveMockRole(user).rol` cuando `USE_MOCK_FUTBOL` (el `rol` del backend se ignora).
- `meContext` se resuelve con `resolveMockContext` cuando `USE_MOCK_FUTBOL`.
- `dniEnPlantelOtroEmail` se agrega al **valor del context** (no al `user`, que es la
  forma que devuelve el backend) para que las vistas lo muestren.

### Tests (funciones puras)

- `resolveMockRole`: jugador match, capitán match, DNI-sin-email-match → usuario + flag,
  sin DNI → usuario, seguidor.
- `resolveMockContext`: el `MeContext` del fixture jugador tiene la forma correcta
  (`equipo`, `proximoPartido`, `standingsPosition`, `personalStats` no nulos).
- `needsDniGate`.

## 5. Vistas personalizadas

Todas consumen `useFutbolIdentity()`. Ningún cambio de ruta.

### 5a. Home del jugador (`HomePage.tsx`)

- **Cabecera:** si `rol` es `jugador` o `capitan`, saludo con nombre + chip del equipo
  ("Los Halcones · Libre A").
- **Mi próximo partido:** la card ya existe (`nextFromCtx`); asegurar que tome del
  adapter y muestre local/visitante, cancha, fecha/hora y "sos local/visitante".
- **Mini-tira de stats** (sólo `jugador`): fila compacta con Goles / Amarillas / Rojas,
  arriba de "Últimos Resultados", con link "Ver mi rendimiento" → `/perfil`.
- **Mi fila en la tabla:** la tabla del home ya resalta `myTeam`; verificar que use el
  equipo del adapter.
- **Aviso email no coincide:** si `dniEnPlantelOtroEmail`, banner sutil: "Tu DNI figura
  en el plantel de {equipo} con otro email. Pedile al capitán que actualice tu email
  para ver tus estadísticas."
- Roles `usuario` / `seguidor`: el home queda como hoy.

Helper `playerHomeSections(ctx): { showStatsStrip: boolean; showEmailMismatch: boolean;
teamLabel: string | null }` + test.

### 5b. Perfil del jugador — bloque "Mi rendimiento" (`ProfilePage.tsx`)

Nueva `<section>` visible sólo si `rol === 'jugador'`, después de "Próximo Partido" y
antes de "Datos Personales":

- **Resumen temporada:** 3 tiles — Goles / Amarillas / Rojas.
- **Suspensión activa:** el bloque rojo ya existe; se mantiene, alimentado por el adapter.
- **Mi posición:** "{N}º en {torneo}" con PJ / Pts, desde `standingsPosition`.
- El bloque "Próximo Partido" ya presente en `ProfilePage` se conecta al adapter.

Rol `seguidor`: la sección "Seguir un equipo" (ya existe) se alimenta de `listMockTeams`
/ `mockFollowTeam` / `mockUnfollowTeam`.

### 5c. Capitán (`CaptainTeamPage.tsx`)

- Conectar `publicApi.captain.getTeam` → `resolveMockCaptainTeam` vía `useFutbolIdentity`.
- **Add / Edit / Remove jugador:** deshabilitados en fase mock, con aviso inline
  "Disponible cuando se conecte el torneo". La tabla del plantel se ve completa
  (nombre, DNI, camiseta, rol).
- **Quitar de `CaptainTeamPage`:** `handlePrintListaBuenaFe`, la llamada
  `getListaBuenaFe`, y su botón. La lista de buena fe es sólo admin.
- **Quitar de `public-api.ts`:** el método `captain.getListaBuenaFe`.
- El endpoint backend `/public/captain/roster/lista-buena-fe` queda marcado para
  eliminarse en la reestructuración del admin (no se toca ahora).
- Entrada al panel: el botón "Administrar equipo" (sidebar + perfil) ya aparece con
  `rol === 'capitan'` (rol del adapter).

### 5d. Router / guardas

- `PublicRouter`: la ruta `/administrar-equipo` está detrás de un guard de rol capitán
  en el front — ajustarlo para leer el `rol` efectivo de `useFutbolIdentity` /
  `PublicAuthContext`.
- El `PublicCaptainGuard` del **backend** no se toca.

## 6. Tests

| Archivo | Cubre |
|---|---|
| `apps/api/test/**` (junto a los tests de auth pública) | `verifyGoogleToken` rechaza `email_verified: false` (mock del `OAuth2Client`) |
| `apps/web-public/src/app/mocks/futbol-identity.test.ts` | `resolveMockRole` (5 casos), `resolveMockContext` (forma de `MeContext`) |
| `apps/web-public/.../auth/auth-helpers.test.ts` | `googleEnabled(clientId?)`, `needsDniGate(user)` |
| `apps/web-public/.../pages/player-home.test.ts` | `playerHomeSections(ctx)` |

Sin tests de render: `apps/web-public` no tiene `@testing-library/react`. Todos los
tests son sobre funciones puras.

## 7. Contrato de integración futura

Cuando la reestructuración del admin exponga los endpoints reales de torneo:

1. `USE_MOCK_FUTBOL = false` en `futbol-identity.ts`.
2. `useFutbolIdentity()` pasa a llamar `publicApi.me.context` / `publicApi.captain.getTeam`
   / `publicApi.me.followTeam` (el branch real ya está escrito, sólo desactivado).
3. La regla email+DNI (`resolveMockRole`) se traslada a `resolveAndUpdateRole` en el
   backend (`apps/api/src/public/public-auth.service.ts`).
4. Re-habilitar add/edit/remove del plantel del capitán en `CaptainTeamPage`.
5. Eliminar el endpoint `/public/captain/roster/lista-buena-fe` y su servicio.

Los tipos `MeContext` / `CaptainTeamData` / `PublicStandingRow` / `PublicTeamOption` **no
cambian de forma** — son el contrato entre el mock y el backend real.

## Global Constraints

- Todo el texto visible al usuario va en **español**.
- Login (Google/email), sesión y DNI: **reales y de producción**.
- Todo lo de torneo (rol jugador/capitán, equipo, partidos, tabla, stats, plantel):
  **mock en el front**, no apto para producción hasta el swap de §7.
- `VITE_GOOGLE_CLIENT_ID` debe ser idéntico a `GOOGLE_CLIENT_ID`. Sin client id → el
  botón de Google no se muestra (graceful, mismo criterio que la API).
- DNI obligatorio: gate bloqueante a pantalla completa; única salida, cerrar sesión.
- Sin cambios de esquema Prisma. Único cambio de backend: `email_verified` en
  `verifyGoogleToken`.
- No hay `@testing-library/react` en `apps/web-public`: los tests son sólo sobre
  funciones puras.
- El `rol` que devuelven `login` / `register` / `completeDni` del backend se **ignora**
  en el front mientras `USE_MOCK_FUTBOL` sea `true`.

## Criterios de éxito

- En la pantalla de login aparece "Continuar con Google" (si hay client id); iniciar
  sesión con Google crea/vincula la cuenta y, si no hay DNI, cae en el gate.
- Un ID token de Google con `email_verified: false` es rechazado por la API.
- Ninguna cuenta sin DNI puede usar la app: el gate ocupa toda la pantalla y sólo deja
  cerrar sesión.
- La cuenta `jugador@lachacra.test` (DNI `30111222`) ve el Home personalizado (mi
  próximo partido, mini-tira de goles/tarjetas, mi fila en la tabla) y el bloque "Mi
  rendimiento" en el Perfil.
- Una cuenta con el DNI `30111222` pero otro email queda como `usuario` y ve el aviso
  "avisá al capitán".
- La cuenta `capitan@lachacra.test` ve su plantel completo; los botones de alta/edición/
  baja están deshabilitados con el aviso de "cuando se conecte el torneo".
- No hay botón de lista de buena fe en la web de clientes.
- `USE_MOCK_FUTBOL = false` deja el código compilando contra los tipos reales (branch
  real escrito).

## Archivos principales

| Área | Archivos |
|---|---|
| Backend auth | `apps/api/src/public/public-auth.service.ts` (`verifyGoogleToken`) |
| Config | `apps/api/.env.example`, nuevo `apps/web-public/.env.example` |
| Google front | nuevo `GoogleSignInButton.tsx`; `AuthForm.tsx`; root/`main.tsx`; `auth-helpers.ts` |
| DNI gate | `DniModal.tsx` → `DniGate.tsx`; `PublicAuthContext.tsx`; `PublicLayout.tsx` |
| Adapter mock | nuevo `mocks/futbol-identity.ts` (+ test); nuevo `useFutbolIdentity.ts` |
| Vistas | `HomePage.tsx`, `ProfilePage.tsx`, `CaptainTeamPage.tsx`, `PublicRouter.tsx` |
| API client | `apps/web-public/src/app/api/public-api.ts` (quitar `captain.getListaBuenaFe`) |
