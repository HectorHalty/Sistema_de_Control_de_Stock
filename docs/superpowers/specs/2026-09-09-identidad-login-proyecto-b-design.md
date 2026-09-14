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
- No hay onboarding: después de registrarse, la persona cae directo en la app sin que
  se le pregunte si es jugador o hincha. El `DniModal` aparece suelto y se puede cerrar.
- Cualquiera que tipee un DNI que figure en un plantel obtiene el rol `jugador` y ve
  las estadísticas de esa persona. No hay verificación de que el DNI sea tuyo.
- La experiencia "soy jugador, veo lo mío" está a medias: el Home intenta mostrar "mi
  próximo partido" y "mi equipo" pero no lo completa; el Perfil sólo muestra la
  suspensión activa, no el resto de las stats.
- El Home muestra datos de un torneo demo aun para quien no tiene equipo, con lógica de
  resaltado de "tu equipo" que sólo aplica a jugadores.

Además, **el lado admin del torneo se va a reestructurar**. Construir las vistas de
jugador/capitán contra `PublicMeService.getMeContext` y `PublicCaptainService` reales
(que leen `Torneo`, `PartidoFutbol`, `InscripcionJugador`, `CapitanAutorizado` y el
motor de reglamento) sería construir sobre un blanco móvil.

## Decisión de alcance: qué es real y qué es mock

| Área | Tratamiento |
|---|---|
| Login con Google (web), login email/contraseña, registro (email + contraseña + nombre) | **Real y definitivo.** |
| Sesión: JWT en `localStorage`, `PublicAuthContext`, Bearer token | **Real y definitivo.** |
| Creación de `CuentaPublica` / `Persona`, `completeDni` (paso jugador del onboarding) | **Real y definitivo.** |
| Chequeo `email_verified` del ID token de Google | **Real** (único cambio de backend). |
| Onboarding "¿jugador o hincha?" (pantalla + persistencia de la elección) | **Front.** |
| Rol efectivo jugador/capitán/seguidor, regla email+DNI | **Mock en el front** (fase actual). |
| Mi equipo, mi próximo partido, tabla de posiciones, mi fila | **Mock en el front.** |
| Stats del jugador (goles/amarillas/rojas/suspensiones) | **Mock en el front.** |
| Plantel del capitán (ver) | **Mock en el front** (read-only en esta fase). |
| Plantel del capitán (alta/edición/baja) | **Deshabilitado** con aviso; se reactiva post-reestructuración. |
| Lista de buena fe | **Fuera de alcance** de la web de clientes (es solo admin). |

**Constraint global:** este build **no es apto para producción del lado torneo** hasta
que el adapter mock se reemplace por llamadas reales (ver §7). El login, la sesión y el
DNI (`completeDni`) sí son de producción.

## Roles y qué puede hacer cada uno

| Estado | Puede | No puede |
|---|---|---|
| **Anónimo** (sin login) | Ver torneo, cantina, fotos, reglamento. Armar carrito. | Confirmar pedido. Seguir un equipo. Ver stats. |
| **`usuario`** (registrado, sin elegir en el onboarding o eligió "más tarde") | Todo lo anterior + confirmar pedidos de cantina. | Seguir un equipo (hasta elegir "hincha"). Ver stats. |
| **`seguidor`** (eligió "hincha" + sigue un equipo) | Todo lo de `usuario` + ver el equipo que sigue destacado en su Home/Perfil. | Ver estadísticas de jugador. |
| **`jugador`** (eligió "jugador" + DNI matchea el plantel por email+DNI) | Todo + Home personalizado + bloque "Mi rendimiento". | Seguir equipos (ya tiene el suyo). Editar el plantel. |
| **`capitan`** (email+DNI matchea `CapitanAutorizado`) | Todo lo de `jugador` + panel "Administrar equipo" (ver plantel; editar deshabilitado en fase mock). | — |

La **vista del torneo es genérica para anónimo y `usuario`**: tabla de posiciones,
próximos partidos y resultados, pero **sin ninguna fila ni equipo resaltado como
"tuyo"** y sin "mi próximo partido".

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
| Registro | email + contraseña + nombre. **Sin DNI.** |
| Onboarding | Después de registrarse (o de un primer login con Google), pantalla "¿Sos jugador o hincha?". Se puede posponer ("Más tarde" → `usuario`); la elección queda siempre disponible desde el Perfil. |
| Camino "jugador" | Pide **sólo el DNI**. Match por DNI + email de login contra el plantel. Sin tipear otro email. |
| Camino "hincha" | Elegir un equipo de los cargados → `seguidor`. Sin DNI, sin stats. |
| Verificación de que el DNI es tuyo | Match `cuenta.email` (login) == `persona.email` de la inscripción **y** el DNI. Sin match → `usuario` + mensaje "avisá al capitán". |
| DNI | **No obligatorio.** Sólo se pide en el camino "jugador" del onboarding. No hay gate bloqueante. |
| Pedir en la cantina | Requiere estar **registrado** (cualquier rol, incluido `usuario`). No requiere DNI. Anónimo puede armar carrito pero no confirmar. |
| Email de Google/login no coincide con el plantel | La cuenta **no** se vincula como jugador. Queda `usuario`. Mensaje: "Tu DNI figura en el plantel de <equipo> con otro email. Pedile al capitán que actualice tu email." Cero UI de admin nueva. |
| Vista genérica (anónimo / `usuario`) | Torneo completo (tabla, próximos partidos, resultados) **sin nada resaltado**, sin "mi próximo partido". |
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
  AuthForm (email/pass + nombre) → POST /public/auth/login | /register  [register: sin campo DNI]

Onboarding (front, una vez, cuando rol === 'usuario' y no se eligió antes)
  "¿Sos jugador o hincha?"
    jugador → form DNI → completeDni (real) → adapter resuelve rol (jugador | usuario+aviso)
    hincha  → elegir equipo → mockFollowTeam → seguidor
    más tarde → queda usuario; re-accesible desde el Perfil

Contexto de fútbol (mock en esta fase)
  useFutbolIdentity()
    USE_MOCK_FUTBOL=true  → adapter mocks/futbol-identity.ts (fixtures)
    USE_MOCK_FUTBOL=false → publicApi.me.context / publicApi.captain.getTeam  [branch ya escrito, desactivado]

Pedidos de cantina
  anónimo → arma carrito, NO confirma (AuthForm en /pago)
  registrado (cualquier rol) → confirma
```

### Unidades

| Unidad | Hace | Se usa en | Depende de |
|---|---|---|---|
| `verifyGoogleToken` (editado) | Valida el ID token; ahora exige `email_verified === true` | `PublicAuthService.loginWithGoogle` | `google-auth-library`, `GOOGLE_CLIENT_ID` |
| `googleEnabled(clientId?)` | `true` sólo con string no vacío | root del front, `GoogleSignInButton` | — |
| `GoogleSignInButton` | Renderiza `<GoogleLogin>`; `onSuccess` → `loginGoogle(credential)`; `null` sin provider | `AuthForm` | `@react-oauth/google`, `PublicAuthContext` |
| `OnboardingGate` | Si `rol === 'usuario'` y no se decidió, muestra "¿jugador o hincha?" sobre la app | `PublicLayout` | `PublicAuthContext`, `onboardingState` |
| `onboardingState` (helper) | `shouldShowOnboarding(user, dismissed): boolean`; persiste elección en `localStorage` | `OnboardingGate`, Perfil | — |
| `JugadorDniStep` (refactor de `DniModal`) | Form de DNI dentro del onboarding jugador; llama `completeDni` | `OnboardingGate`, Perfil | `PublicAuthContext` |
| `futbol-identity.ts` (adapter mock) | Resuelve rol + contexto + plantel desde fixtures | `useFutbolIdentity`, `PublicAuthContext` | tipos `MeContext` / `CaptainTeamData` |
| `useFutbolIdentity()` | Único punto de integración: mock o `publicApi` según el flag | Home, Perfil, CaptainTeamPage, PublicRouter | `futbol-identity.ts`, `publicApi` |
| `playerHomeSections(ctx)` | Qué secciones muestra el Home del jugador | `HomePage` | — |

## 1. Backend (acotado)

Dos cambios, ambos en `apps/api/src/public/`. Sin cambios de esquema Prisma.
`resolveAndUpdateRole`, `getMeContext`, `PublicCaptainService` quedan igual. El `rol`
que devuelven `login` / `register` / `completeDni` **se ignora en el front durante la
fase mock**.

### 1a. `verifyGoogleToken` — exigir email verificado

En `public-auth.service.ts`, dentro de `verifyGoogleToken`, después de validar
`payload?.sub` y `payload.email`:

```ts
if (payload.email_verified !== true) {
  throw new UnauthorizedException('Tu email de Google no está verificado.');
}
```

### 1b. `register` — sin DNI

Hoy `register()` exige `dto.dni` (7+ dígitos), crea una `Persona` y la vincula. El
registro pasa a ser sólo cuenta:

- `RegisterDto` (`dto/public-auth.dto.ts`): **quitar** el campo `dni` (era
  `@IsString @IsNotEmpty`).
- `PublicAuthService.register`: quitar la normalización/validación de DNI, el
  `persona.upsert` y `personaId` / `dniConfirmado` del `create`. Queda:
  ```ts
  const cuenta = await this.prisma.cuentaPublica.create({
    data: { email, passwordHash, nombre: dto.nombre.trim(), rol: 'usuario' },
  });
  ```
- El DNI se carga después, en el paso "jugador" del onboarding, vía `completeDni`
  (que ya existe y ya hace el `persona.upsert` + set `personaId` / `dniConfirmado`).
- `completeDni` **no cambia**.
- Tests de backend afectados: cualquiera que llame `register` con `dni`. Ajustar los
  fixtures.

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

**Registro sin DNI:** quitar de `AuthForm` (modo `register`) el input de DNI, su estado
y su validación. El registro queda: nombre + email + contraseña + confirmar. El contrato
de `RegisterDto` / `PublicAuthService.register` se ajusta en §1b, y `publicApi.auth.register`
deja de mandar `dni`.

Tras `loginGoogle` / `register` exitoso: el `OnboardingGate` de §3 evalúa si mostrar
la pantalla "¿jugador o hincha?". Sin lógica extra en `AuthForm`.

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

## 3. Onboarding: "¿Sos jugador o hincha?"

### Cuándo se muestra

`OnboardingGate`, montado en `PublicLayout` por encima del `<Outlet />` (pero **no**
bloquea navegación: es un overlay que se puede posponer).

`shouldShowOnboarding(user, dismissed)`:
- `true` si `user` existe **y** su `rol` efectivo (del adapter) es `'usuario'` **y**
  no hay flag `lch_onboarding_done` en `localStorage`.
- `false` para anónimo, para roles `seguidor`/`jugador`/`capitan` (ya eligieron), o si
  se pospuso.

La elección persiste en `localStorage` (`lch_onboarding_done = '1'`). Se limpia en
`logout`. Siempre re-accesible desde el Perfil (sección "Mi vínculo con el torneo").

### La pantalla

Overlay a pantalla (con fondo semitransparente), dos opciones grandes:

- **"Soy jugador"** → paso `JugadorDniStep`:
  - Form con un input DNI numérico + botón "Confirmar".
  - `completeDni(dni)` (real). Al volver, el adapter (`resolveMockRole`) decide:
    - DNI + email de login matchean el plantel → `rol: 'jugador'`, se cierra el
      onboarding, aparece el Home personalizado.
    - DNI matchea pero el email no → `rol: 'usuario'` + `dniEnPlantelOtroEmail`. Se
      cierra el onboarding y se muestra el aviso "pedile al capitán que actualice tu
      email" en el Home (§5a).
    - DNI no está en ningún plantel → `rol: 'usuario'`. Mensaje: "No encontramos tu DNI
      en ningún plantel. Si creés que es un error, hablá con tu capitán." Se cierra el
      onboarding.
  - Link "Volver" al paso anterior.
- **"Soy hincha"** → paso team picker:
  - Lista de equipos (`listMockTeams`, con buscador). Elegir uno → `mockFollowTeam` →
    `rol: 'seguidor'`. Se cierra el onboarding.
  - Este picker es el mismo componente que ya usa el Perfil para "Seguir un equipo";
    se extrae a un componente reutilizable.
- **"Más tarde"** (link discreto) → setea el flag, cierra el onboarding, queda
  `usuario`.

### `JugadorDniStep` (refactor de `DniModal`)

`DniModal` se convierte en `JugadorDniStep` — el mismo form de DNI, pero:
- Sin comportamiento de modal suelto (no se auto-monta desde el context).
- Se usa dentro de `OnboardingGate` y desde el Perfil.
- Se **elimina** de `PublicAuthContext`: `showDniModal`, `setShowDniModal`, y el
  `if (ctx.user.needsDni) setShowDniModal(true)`. El `needsDni` del backend deja de
  gatillar UI automática.

### Helpers + tests

- `shouldShowOnboarding(user, dismissed): boolean`.
- (Sin gate de DNI: se elimina el concepto.)

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

// Torneo genérico, sin usuario: para el Home de anónimo y `usuario`.
export function mockTorneoPublico(): {
  torneo: { id: string; nombre: string; categoria: string };
  standings: PublicStandingRow[];
  proximosPartidos: PublicMatchPreview[];
  resultados: { id: string; local: string; visitante: string; golesLocal: number; golesVisitante: number; fecha: string }[];
};
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

**Anónimo (sin `user`):** `meContext` = `null`, `role.rol` = `'usuario'`. Las vistas
tratan a `meContext === null` y a `rol === 'usuario'` igual → vista genérica del torneo.
El torneo genérico (tabla + próximos partidos + resultados) sale de un fixture aparte
del adapter, `mockTorneoPublico()`, que **no** depende del `user` — así el Home de
anónimo y de `usuario` muestran el mismo torneo sin nada resaltado.

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
- `shouldShowOnboarding`.
- `playerHomeSections`.

## 5. Vistas personalizadas

Todas consumen `useFutbolIdentity()`. Ningún cambio de ruta.

### 5a. Home (`HomePage.tsx`)

`playerHomeSections(role, meContext): { showStatsStrip, showEmailMismatch, teamLabel,
showMiProximoPartido, highlightTeamId | null }` + test. Decide todo lo condicional:

- **Anónimo y `usuario`:** torneo genérico. Tabla de posiciones, próximos partidos y
  resultados desde `mockTorneoPublico()`. **Ninguna fila resaltada**, sin "mi próximo
  partido", sin chip de equipo. CTA a la cantina y a las fotos como hoy. Si es anónimo,
  además un CTA "Iniciá sesión para seguir tu equipo".
- **`seguidor`:** igual que `usuario` + su equipo seguido resaltado en la tabla + card
  "próximo partido de {equipo}". Sin stats personales.
- **`jugador` / `capitan`:**
  - Cabecera: saludo con nombre + chip del equipo ("Los Halcones · Libre A").
  - Card "Mi próximo partido" (ya existe como `nextFromCtx`): local/visitante, cancha,
    fecha/hora, "sos local/visitante".
  - Mini-tira de stats (**sólo `jugador`**): Goles / Amarillas / Rojas, arriba de
    "Últimos Resultados", link "Ver mi rendimiento" → `/perfil`.
  - Su fila resaltada en la tabla.
- **Aviso email no coincide** (cuando `dniEnPlantelOtroEmail`, rol `usuario`): banner:
  "Tu DNI figura en el plantel de {equipo} con otro email. Pedile al capitán que
  actualice tu email para ver tus estadísticas."

Se **elimina** de `HomePage` la lógica `useDemoTorneo` / datos demo sueltos — el torneo
genérico viene del adapter (`mockTorneoPublico`), no de un fallback ad-hoc.

### 5b. Perfil del jugador — bloque "Mi rendimiento" (`ProfilePage.tsx`)

Nueva `<section>` visible sólo si `rol === 'jugador'`, después de "Próximo Partido" y
antes de "Datos Personales":

- **Resumen temporada:** 3 tiles — Goles / Amarillas / Rojas.
- **Suspensión activa:** el bloque rojo ya existe; se mantiene, alimentado por el adapter.
- **Mi posición:** "{N}º en {torneo}" con PJ / Pts, desde `standingsPosition`.
- El bloque "Próximo Partido" ya presente en `ProfilePage` se conecta al adapter.

Rol `seguidor`: la sección "Seguir un equipo" (ya existe) se alimenta de `listMockTeams`
/ `mockFollowTeam` / `mockUnfollowTeam`.

**Sección "Mi vínculo con el torneo"** (todos los roles, arriba de "Seguir un equipo"):
re-abre el onboarding. Para `usuario` muestra los dos botones "Soy jugador" / "Soy
hincha"; para `jugador`/`capitan` muestra el equipo vinculado; para `seguidor` muestra
"Seguís a {equipo}" con opción de dejar de seguir o cambiar a jugador.

### 5c bis. Cantina y anónimo

- **Sin login:** `/cantina` y `/carrito` funcionan (el carrito ya vive en `localStorage`).
  `/pago` ya muestra `AuthForm` si `!user` — se mantiene. Se agrega un texto claro:
  "Necesitás una cuenta para confirmar el pedido y recibir tu código QR." Nada de DNI.
- **Con login (cualquier rol, incluido `usuario`):** confirma el pedido como hoy.
- El `PublicOrdersController` del backend ya exige sesión (`PublicAuthGuard`) — sin
  cambios.

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
| `apps/api/test/**` (junto a los tests de auth pública) | `verifyGoogleToken` rechaza `email_verified: false` (mock del `OAuth2Client`); `register` crea la cuenta sin `dni` (sin `Persona`, `rol: 'usuario'`) |
| `apps/web-public/src/app/mocks/futbol-identity.test.ts` | `resolveMockRole` (5 casos), `resolveMockContext` (forma de `MeContext`), `mockTorneoPublico` (forma) |
| `apps/web-public/.../auth/auth-helpers.test.ts` | `googleEnabled(clientId?)`, `shouldShowOnboarding(user, dismissed)` |
| `apps/web-public/.../pages/player-home.test.ts` | `playerHomeSections(role, meContext)` — genérico / seguidor / jugador / email-mismatch |

Sin tests de render: `apps/web-public` no tiene `@testing-library/react`. Todos los
tests son sobre funciones puras.

## 7. Contrato de integración futura

Cuando la reestructuración del admin exponga los endpoints reales de torneo:

1. `USE_MOCK_FUTBOL = false` en `futbol-identity.ts`.
2. `useFutbolIdentity()` pasa a llamar `publicApi.me.context` / `publicApi.captain.getTeam`
   / `publicApi.me.followTeam` y el Home genérico a `publicApi.homeBundle` / `publicApi.torneo`
   (el branch real **todavía no está escrito**: hoy `useFutbolIdentity()` lanza un error
   ruidoso si se invierte la bandera antes del swap, y hay que implementarlo como parte
   de la reestructuración, respetando la interfaz `FutbolIdentity`).
3. La regla email+DNI (`resolveMockRole`) se traslada a `resolveAndUpdateRole` en el
   backend (`apps/api/src/public/public-auth.service.ts`), y el paso "jugador" del
   onboarding empieza a confiar en el `rol` que devuelve `completeDni`.
4. Re-habilitar add/edit/remove del plantel del capitán en `CaptainTeamPage`.
5. Eliminar el endpoint `/public/captain/roster/lista-buena-fe` y su servicio.

Los tipos `MeContext` / `CaptainTeamData` / `PublicStandingRow` / `PublicTeamOption` /
`PublicMatchPreview` **no cambian de forma** — son el contrato entre el mock y el
backend real.

## Global Constraints

- Todo el texto visible al usuario va en **español**.
- Login (Google/email), sesión y `completeDni`: **reales y de producción**.
- Todo lo de torneo (rol jugador/capitán/seguidor, equipo, partidos, tabla, stats,
  plantel, torneo genérico): **mock en el front**, no apto para producción hasta §7.
- `VITE_GOOGLE_CLIENT_ID` debe ser idéntico a `GOOGLE_CLIENT_ID`. Sin client id → el
  botón de Google no se muestra (graceful, mismo criterio que la API).
- **DNI: no obligatorio.** Sólo se pide en el paso "jugador" del onboarding. No hay gate.
- Registro: email + contraseña + nombre. Sin DNI.
- Anónimo: arma carrito, no confirma pedidos, ve el torneo genérico sin nada resaltado.
- Sin cambios de esquema Prisma. Cambios de backend: (a) `email_verified` en
  `verifyGoogleToken`, (b) `register` sin `dni`.
- No hay `@testing-library/react` en `apps/web-public`: los tests son sólo sobre
  funciones puras.
- El `rol` que devuelven `login` / `register` / `completeDni` del backend se **ignora**
  en el front mientras `USE_MOCK_FUTBOL` sea `true` — el rol efectivo lo da el adapter.
- El onboarding se muestra **una vez** (flag en `localStorage`, se limpia en `logout`);
  siempre re-accesible desde el Perfil.

## Criterios de éxito

- En la pantalla de login aparece "Continuar con Google" (si hay client id); iniciar
  sesión con Google crea/vincula la cuenta.
- Un ID token de Google con `email_verified: false` es rechazado por la API.
- El registro pide sólo nombre + email + contraseña; crea la cuenta con `rol: 'usuario'`
  y sin `Persona`.
- Tras registrarse aparece "¿Sos jugador o hincha?". "Más tarde" deja `usuario` y no
  vuelve a aparecer sola.
- Camino "hincha": elegir un equipo → `seguidor` → el equipo aparece destacado en Home
  y Perfil, sin stats de jugador.
- Camino "jugador" con `jugador@lachacra.test` + DNI `30111222` → `jugador` → Home
  personalizado (mi próximo partido, mini-tira de goles/tarjetas, mi fila en la tabla)
  + bloque "Mi rendimiento" en el Perfil.
- Camino "jugador" con el DNI `30111222` pero otro email → queda `usuario` + aviso
  "avisá al capitán".
- `capitan@lachacra.test` ve su plantel completo; alta/edición/baja deshabilitadas con
  el aviso "cuando se conecte el torneo".
- Anónimo y `usuario`: Home con torneo genérico, ninguna fila resaltada, sin "mi
  próximo partido". Anónimo puede armar carrito; `/pago` pide cuenta.
- No hay botón de lista de buena fe en la web de clientes.
- `USE_MOCK_FUTBOL = false` deja el código compilando contra los tipos reales.

## Archivos principales

| Área | Archivos |
|---|---|
| Backend | `apps/api/src/public/public-auth.service.ts` (`verifyGoogleToken`, `register`), `apps/api/src/public/dto/public-auth.dto.ts` (`RegisterDto` sin `dni`) |
| Config | `apps/api/.env.example`, nuevo `apps/web-public/.env.example` |
| Google front | nuevo `GoogleSignInButton.tsx`; `AuthForm.tsx` (sin DNI en registro); root/`main.tsx`; `auth-helpers.ts` |
| Onboarding | `DniModal.tsx` → `JugadorDniStep.tsx`; nuevo `OnboardingGate.tsx`; nuevo componente team-picker reutilizable; `PublicAuthContext.tsx` (sacar `showDniModal`); `PublicLayout.tsx`; `ProfilePage.tsx` (sección "Mi vínculo") |
| Adapter mock | nuevo `mocks/futbol-identity.ts` (+ test); nuevo `useFutbolIdentity.ts` |
| Vistas | `HomePage.tsx` (torneo genérico + personalizado), `ProfilePage.tsx`, `CaptainTeamPage.tsx`, `PublicRouter.tsx` |
| API client | `apps/web-public/src/app/api/public-api.ts` (quitar `captain.getListaBuenaFe`) |
