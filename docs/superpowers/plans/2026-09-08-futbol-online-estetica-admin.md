# Alineación estética de Fútbol y Online al panel admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los módulos `features/futbol` y `features/online` de web-admin usen la misma estética que el resto del panel admin (encabezados, radios, botones, inputs, contenedores), sin tocar lógica ni API.

**Architecture:** Todo el peso del cambio vive en dos helpers compartidos (`futbol-shared.tsx`, `online-shared.tsx`): `PanelShell`, `fieldClass`, `buttonClass` y un nuevo `panelCardClass`. Cada panel consume esos helpers, así que actualizarlos propaga el 80% del cambio. El resto es un pase mecánico por panel: swaps de radio (`rounded-xl`/`rounded-2xl` → `rounded-lg` en controles chicos), `bg-input-background` → `bg-card`, y quitar la caja `rounded-2xl border` que envuelve cada módulo.

**Tech Stack:** React 18 + TypeScript, Vite, Tailwind (v4, tokens en `apps/web-admin/src/styles/theme.css`), lucide-react, react-router.

**Spec:** Diseño acordado en la conversación de brainstorming de esta sesión (resumido abajo en "Diseño de referencia"). Tarea clasificada como *bounded*: pase cosmético siguiendo patrones ya existentes en el admin (referencia canónica: `apps/web-admin/src/features/inventory/pages/WarehousesPage.tsx`).

## Global Constraints

- **No cambiar lógica, handlers, llamadas a API, tipos ni props de datos.** Solo `className`, estructura de encabezado, y el wrapper de módulo.
- **Verde:** usar el hex fijo del admin, NO el token `bg-primary` (que en dark se vuelve neón `#6bff9e`). Primario: `bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white`. Acentos suaves: `bg-[#3d7a3d]/10 text-[#3d7a3d]`. No tocar archivos fuera de `features/futbol` y `features/online`.
- **Radios:** `rounded-lg` en botones, inputs, selects, badges rectangulares, chips y controles chicos. `rounded-xl` se mantiene solo en cards/paneles contenedores. `rounded-full` se mantiene en badges tipo píldora y avatares circulares. Prohibido `rounded-2xl` en estos módulos.
- **Inputs:** fondo `bg-card` (no `bg-input-background`), foco `focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20`.
- **Encabezado de panel:** el que provee `PanelShell` tras la Task 1/2 — `<h1 className="text-foreground">` + subtítulo muted opcional + slot de acciones opcional. Los paneles no vuelven a renderizar su propio `<h1>`/`<h2>` de título.
- **Verificación por task** (reemplaza el ciclo TDD clásico; esto es CSS, no lógica):
  1. `npx tsc --noEmit -p apps/web-admin` → sin errores nuevos.
  2. `npm run test:admin` → verde (por si algún test snapshotea markup).
  3. Visual: dev server `web-admin` + browser, revisar los paneles tocados en claro **y** oscuro.
- **Commits:** uno por task, mensaje `style(futbol|online): ...`, terminando con:
  ```
  Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
  ```

### Diseño de referencia (patrón admin, de `WarehousesPage.tsx`)

- Header de página: `flex flex-col sm:flex-row sm:items-center justify-between gap-4` con `<div><h1 className="text-foreground">Título</h1><p className="text-sm text-muted-foreground mt-1">subtítulo</p></div>` y a la derecha el botón de acción.
- Botón primario: `flex items-center gap-2 bg-[#3d7a3d] hover:bg-[#2f5f2f] text-white px-4 py-2.5 rounded-lg transition-colors shadow-sm`.
- Card: `bg-card rounded-xl border border-border shadow-sm`.
- Input: `w-full px-3 py-2 rounded-lg bg-card border border-border text-sm outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20`.
- Contenido de página directo dentro de `<main>` (que ya aporta `p-4 lg:p-6`), envuelto en `space-y-6`. Sin borde exterior.

### Mapa de archivos

**Se modifican (núcleo):**
- `apps/web-admin/src/features/futbol/futbol-shared.tsx` — helpers.
- `apps/web-admin/src/features/online/online-shared.tsx` — helpers.
- `apps/web-admin/src/features/futbol/FutbolModule.tsx` — wrapper.
- `apps/web-admin/src/features/online/OnlineModule.tsx` — wrapper.

**Se modifican (pase mecánico, paneles fútbol):**
`panels/FutbolInicioPanel.tsx`, `panels/EquiposPanel.tsx`, `panels/CategoriasPanel.tsx`, `panels/FixturePanel.tsx`, `panels/HorariosCanchasPanel.tsx`, `panels/ResultadosPanel.tsx`, `panels/PosicionesPanel.tsx`, `panels/PlanillasPanel.tsx`, `panels/ReglamentoPanel.tsx`, `panels/SuspendidosPanel.tsx`, `panels/MediaPanel.tsx`, `panels/FixtureGridPreview.tsx`, `panels/SaturdayGridPreview.tsx`, `components/TeamLogoUpload.tsx`, `components/FutbolSettingsPanel.tsx`.

**Se modifican (pase mecánico, online):**
`panels/OnlineInicioPanel.tsx`, `panels/CocinaOnlinePanel.tsx`, `panels/MenuWebPanel.tsx`, `panels/SponsorsPanel.tsx`, `panels/MetricasPanel.tsx`, `OnlineMediaUpload.tsx`, `QrScanOverlay.tsx`, `SalesProductPicker.tsx`, `OnlineKitchenTicket.tsx`, `components/OnlineSettingsPanel.tsx`.

**No se tocan:** nada fuera de `features/futbol` y `features/online`.

---

### Task 1: Helpers compartidos de Fútbol

**Files:**
- Modify: `apps/web-admin/src/features/futbol/futbol-shared.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `futbolFieldClass(extra?: string): string`
  - `futbolButtonClass(variant?: 'primary' | 'ghost', extra?: string): string`
  - `futbolCardClass(extra?: string): string` — **nuevo**
  - `<FutbolPanelShell title={string} subtitle?={string} actions?={React.ReactNode}>` — firma ampliada
  - `<FutbolError message={string} />`, `<FutbolSuccess message={string} />` (sin cambio de firma)

- [ ] **Step 1: Reemplazar `futbolFieldClass`, `futbolButtonClass` y agregar `futbolCardClass`**

En `futbol-shared.tsx`, reemplazar las funciones `futbolFieldClass` y `futbolButtonClass` actuales (líneas ~42-52) por:

```tsx
export function futbolFieldClass(extra = '') {
  return `w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 ${extra}`.trim();
}

export function futbolButtonClass(variant: 'primary' | 'ghost' = 'primary', extra = '') {
  const base =
    variant === 'ghost'
      ? 'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50'
      : 'inline-flex items-center gap-2 rounded-lg bg-[#3d7a3d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f5f2f] disabled:opacity-50';
  return `${base} ${extra}`.trim();
}

export function futbolCardClass(extra = '') {
  return `rounded-xl border border-border bg-card shadow-sm ${extra}`.trim();
}
```

- [ ] **Step 2: Ampliar `FutbolPanelShell` al header del admin**

Reemplazar el componente `FutbolPanelShell` actual (líneas ~54-67) por:

```tsx
export function FutbolPanelShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 pb-20 lg:pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Unificar radios de `FutbolError` / `FutbolSuccess`**

En ambos componentes cambiar `rounded-xl` → `rounded-lg` en su `className`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/web-admin`
Expected: PASS (0 errores). Nota: los paneles todavía pasan solo `title=` — la nueva firma es retrocompatible.

- [ ] **Step 5: Tests**

Run: `npm run test:admin`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/features/futbol/futbol-shared.tsx
git commit -m "style(futbol): alinear helpers compartidos a la estetica del admin"
```

---

### Task 2: Helpers compartidos de Online

**Files:**
- Modify: `apps/web-admin/src/features/online/online-shared.tsx`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `onlineFieldClass(extra?: string): string`
  - `onlineButtonClass(variant?: 'primary' | 'ghost', extra?: string): string`
  - `onlineCardClass(extra?: string): string` — **nuevo**
  - `<OnlinePanelShell title={string} subtitle?={string} actions?={React.ReactNode}>` — firma ampliada
  - `<OnlineError message={string} />` (sin cambio de firma)
  - `STATUS_LABELS`, `NEXT_KITCHEN_STATUS` (sin cambio)

- [ ] **Step 1: Reemplazar `onlineFieldClass` / `onlineButtonClass` y agregar `onlineCardClass`**

Reemplazar (líneas ~30-39) por:

```tsx
export function onlineFieldClass(extra = '') {
  return `w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-[#3d7a3d] focus:ring-2 focus:ring-[#3d7a3d]/20 ${extra}`.trim();
}

export function onlineButtonClass(variant: 'primary' | 'ghost' = 'primary', extra = '') {
  const base =
    variant === 'ghost'
      ? 'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted disabled:opacity-50'
      : 'inline-flex items-center gap-2 rounded-lg bg-[#3d7a3d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#2f5f2f] disabled:opacity-50';
  return `${base} ${extra}`.trim();
}

export function onlineCardClass(extra = '') {
  return `rounded-xl border border-border bg-card shadow-sm ${extra}`.trim();
}
```

Nota: `onlineButtonClass` pasa a aceptar un segundo parámetro `extra` (antes no lo tenía). Retrocompatible con las llamadas actuales.

- [ ] **Step 2: Ampliar `OnlinePanelShell`**

Reemplazar (líneas ~41-54) por:

```tsx
export function OnlinePanelShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6 pb-20 lg:pb-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
```

- [ ] **Step 3: `OnlineError` ya usa `rounded-lg`** — verificar que sí (línea ~58); si dice `rounded-xl`, cambiarlo.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p apps/web-admin`
Expected: PASS.

- [ ] **Step 5: Tests**

Run: `npm run test:admin`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/features/online/online-shared.tsx
git commit -m "style(online): alinear helpers compartidos a la estetica del admin"
```

---

### Task 3: Quitar la caja exterior de los módulos

**Files:**
- Modify: `apps/web-admin/src/features/futbol/FutbolModule.tsx:70`
- Modify: `apps/web-admin/src/features/online/OnlineModule.tsx:53`

**Interfaces:**
- Consumes: nada.
- Produces: nada (solo markup del contenedor raíz de cada módulo).

- [ ] **Step 1: FutbolModule — reemplazar el wrapper**

Cambiar:

```tsx
    <div className="h-full min-h-[calc(100vh-12rem)] rounded-2xl border border-border">
```

por:

```tsx
    <div className="min-h-[calc(100vh-16rem)]">
```

(Se quita `rounded-2xl border border-border` y el `h-full`; se conserva un min-height para que los paneles vacíos no colapsen.)

- [ ] **Step 2: OnlineModule — mismo cambio**

En `OnlineModule.tsx:53` aplicar exactamente el mismo reemplazo.

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit -p apps/web-admin && npm run test:admin`
Expected: PASS.

- [ ] **Step 4: Verificación visual**

Levantar dev server (`web-admin`, launch.json) y en el browser abrir `/futbol?tab=inicio` y `/online?tab=inicio`. Confirmar que el contenido queda a ras del `<main>` sin doble borde, igual que `/almacenes`. Screenshot claro + oscuro.

- [ ] **Step 5: Commit**

```bash
git add apps/web-admin/src/features/futbol/FutbolModule.tsx apps/web-admin/src/features/online/OnlineModule.tsx
git commit -m "style(futbol,online): quitar caja exterior de los modulos para igualar al admin"
```

---

### Task 4: Pase mecánico — paneles de Fútbol (grupo A: dashboards y ABMs)

**Files:**
- Modify: `apps/web-admin/src/features/futbol/panels/FutbolInicioPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/EquiposPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/CategoriasPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/components/TeamLogoUpload.tsx`

**Interfaces:**
- Consumes de Task 1: `futbolCardClass`, `FutbolPanelShell` con `subtitle`/`actions`, `futbolFieldClass`, `futbolButtonClass`.
- Produces: nada.

**Reglas del pase (aplican a cada archivo del grupo, por las Global Constraints):**
1. En `className` de `<div>`/`<form>`/`<section>` contenedoras que hoy sean `rounded-xl border border-border bg-card p-N` → reemplazar el trío `rounded-xl border border-border bg-card` por `${futbolCardClass()}` manteniendo el padding (`futbolCardClass('p-4')`, etc.). Si ya se importa una string template, agregar `futbolCardClass` al import desde `../futbol-shared`.
2. `rounded-xl` / `rounded-2xl` en botones `<button>`, `<input>`, `<select>`, chips y badges rectangulares → `rounded-lg`. Dejar `rounded-full` como está.
3. `bg-input-background` → `bg-card` (si quedara alguno fuera del helper).
4. `bg-primary` / `text-primary-foreground` / `bg-primary/10` / `text-primary` usados como color de marca → `bg-[#3d7a3d]` / `text-white` / `bg-[#3d7a3d]/10` / `text-[#3d7a3d]`. (Los `border-primary/30 bg-primary/10 text-primary` de mensajes de éxito también.)
5. Subsecciones internas con `text-lg font-bold` o `text-xl font-bold` como encabezado de bloque → `text-sm font-semibold text-foreground`. Los números grandes de stat cards (`text-2xl font-bold`) NO se tocan.

**Wiring de encabezado específico:**

- [ ] **Step 1: FutbolInicioPanel — subtítulo**

En todas las apariciones de `<FutbolPanelShell title="Torneo">` / `title="Torneo activo"` agregar `subtitle="Configuración del torneo publicado en la web pública"`. Ejemplo la principal (línea ~88):

```tsx
    <FutbolPanelShell title="Torneo activo" subtitle="Configuración del torneo publicado en la web pública">
```

- [ ] **Step 2: FutbolInicioPanel — pase mecánico**

Aplicar reglas 1-5. Puntos concretos:
- Línea ~89: `flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4` → `flex flex-wrap items-end gap-3 ${futbolCardClass('p-4')}` (convertir a template string).
- Línea ~133: `rounded-lg border border-primary/30 bg-primary/10 ... text-primary` → `rounded-lg border border-[#3d7a3d]/30 bg-[#3d7a3d]/10 px-4 py-2 text-sm text-[#3d7a3d]`.
- Línea ~138: `rounded-xl border border-border bg-card p-5` → `${futbolCardClass('p-5')}`.
- Línea ~141: `text-xl font-bold` (nombre del torneo) → dejar (es el título de la card, no un encabezado de sección) pero bajar a `text-lg font-semibold`.
- Líneas ~146-150: `bg-primary/15 text-primary` → `bg-[#3d7a3d]/15 text-[#3d7a3d]`.
- Línea ~184: `rounded-xl border border-border bg-card p-4` (stat cards) → `${futbolCardClass('p-4')}`.

- [ ] **Step 3: EquiposPanel — encabezado + pase**

- Línea ~387: `<FutbolPanelShell title="Equipos">` → `<FutbolPanelShell title="Equipos" subtitle={\`${rows.length} equipo(s) inscriptos\`}>`.
- Líneas ~82, ~213, ~235, ~293: `rounded-xl border border-border bg-card p-4` → `${futbolCardClass('p-4')}`.
- Línea ~209: `space-y-4 border-t border-border bg-muted/30 p-4` → dejar (es panel de detalle expandido, patrón válido tipo `WarehousesPage`).
- Líneas ~251, ~308: `rounded-lg border border-border` / `overflow-x-auto rounded-xl border border-border` de la tabla → la tabla puede quedar `rounded-xl` (contenedor). El `<li>` `rounded-lg` ya está bien.
- Líneas ~323, ~327: `bg-primary/10` / `bg-primary text-primary-foreground` → `bg-[#3d7a3d]/10` / `bg-[#3d7a3d] text-white`.
- Líneas ~418-423: badge de estado `bg-primary/10 text-primary` → `bg-[#3d7a3d]/10 text-[#3d7a3d]` (mantener `rounded-full`).
- Íconos `text-primary` (Shield, línea ~237) → `text-[#3d7a3d]`.
- Agregar `futbolCardClass` al import de `../futbol-shared`.

- [ ] **Step 4: CategoriasPanel — encabezado + pase**

- Línea ~198: agregar `subtitle` describiendo el contenido (ej. `subtitle="Categorías y torneos del campeonato"`).
- Aplicar reglas 1-5 en todo el archivo (revisar cada `rounded-xl`/`bg-primary`/`text-lg font-bold`).

- [ ] **Step 5: TeamLogoUpload — pase**

Aplicar reglas 2 y 4 (radios de botones/preview a `rounded-lg`, colores de marca al hex). Mantener `rounded-xl`/`rounded-lg` del recuadro de preview según sea contenedor o control.

- [ ] **Step 6: Typecheck + tests**

Run: `npx tsc --noEmit -p apps/web-admin && npm run test:admin`
Expected: PASS.

- [ ] **Step 7: Verificación visual**

Dev server + browser: `/futbol?tab=inicio`, `/futbol?tab=equipos` (expandir un equipo), `/futbol?tab=categorias`. Claro y oscuro. Comparar contra `/almacenes`: mismo peso de `<h1>`, mismos botones verdes, mismos inputs. Screenshot antes/después de Equipos.

- [ ] **Step 8: Commit**

```bash
git add apps/web-admin/src/features/futbol/panels/FutbolInicioPanel.tsx apps/web-admin/src/features/futbol/panels/EquiposPanel.tsx apps/web-admin/src/features/futbol/panels/CategoriasPanel.tsx apps/web-admin/src/features/futbol/components/TeamLogoUpload.tsx
git commit -m "style(futbol): alinear paneles inicio/equipos/categorias al admin"
```

---

### Task 5: Pase mecánico — paneles de Fútbol (grupo B: fixture, resultados, tablas, planillas)

**Files:**
- Modify: `apps/web-admin/src/features/futbol/panels/FixturePanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/HorariosCanchasPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/ResultadosPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/PosicionesPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/PlanillasPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/ReglamentoPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/SuspendidosPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/MediaPanel.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/FixtureGridPreview.tsx`
- Modify: `apps/web-admin/src/features/futbol/panels/SaturdayGridPreview.tsx`
- Modify: `apps/web-admin/src/features/futbol/components/FutbolSettingsPanel.tsx`

**Interfaces:**
- Consumes de Task 1: `futbolCardClass`, `FutbolPanelShell`, `futbolFieldClass`, `futbolButtonClass`.
- Produces: nada.

- [ ] **Step 1: Aplicar el pase mecánico (reglas 1-5 de Task 4) a cada archivo del grupo**

Para cada archivo: leerlo completo, aplicar las 5 reglas. Además, en la línea del `<FutbolPanelShell title="...">` agregar un `subtitle` corto de una línea que describa la pantalla:
- FixturePanel → `subtitle="Generá y editá el fixture del torneo"`
- HorariosCanchasPanel → `subtitle="Asigná horarios y canchas por jornada"`
- ResultadosPanel → `subtitle="Cargá resultados y eventos de cada partido"`
- PosicionesPanel → `subtitle="Tabla calculada a partir de los resultados"`
- PlanillasPanel → `subtitle="Descargá las planillas de cancha en PDF"`
- ReglamentoPanel → `subtitle="Texto del reglamento publicado en la web"`
- SuspendidosPanel → `subtitle="Jugadores con sanción vigente"`
- MediaPanel → `subtitle="Fotos y videos por fecha para la web pública"`

`FixtureGridPreview.tsx`, `SaturdayGridPreview.tsx` y `FutbolSettingsPanel.tsx` no tienen `PanelShell`: solo reglas 1-5.

- [ ] **Step 2: Grillas de fixture — cuidar contenedores**

En `FixtureGridPreview.tsx` / `SaturdayGridPreview.tsx` / `FixtureGridPreview` embebido: los contenedores de grilla con `rounded-xl border` se mantienen `rounded-xl` (son cards). Solo los botones/celdas interactivas tipo chip pasan a `rounded-lg`. No romper el layout de grid (no tocar `grid-cols`, `gap`, `min-w`).

- [ ] **Step 3: Typecheck + tests**

Run: `npx tsc --noEmit -p apps/web-admin && npm run test:admin`
Expected: PASS.

- [ ] **Step 4: Verificación visual**

Browser: recorrer `/futbol?tab=fixture`, `tab=horarios`, `tab=resultados`, `tab=posiciones`, `tab=planillas`, `tab=reglamento`, `tab=suspendidos`, `tab=media`. Claro y oscuro. Verificar que las grillas de fixture no se deformaron. Screenshot de fixture y posiciones.

- [ ] **Step 5: Commit**

```bash
git add apps/web-admin/src/features/futbol/panels apps/web-admin/src/features/futbol/components/FutbolSettingsPanel.tsx
git commit -m "style(futbol): alinear paneles de fixture/resultados/tablas/planillas al admin"
```

---

### Task 6: Pase mecánico — módulo Online

**Files:**
- Modify: `apps/web-admin/src/features/online/panels/OnlineInicioPanel.tsx`
- Modify: `apps/web-admin/src/features/online/panels/CocinaOnlinePanel.tsx`
- Modify: `apps/web-admin/src/features/online/panels/MenuWebPanel.tsx`
- Modify: `apps/web-admin/src/features/online/panels/SponsorsPanel.tsx`
- Modify: `apps/web-admin/src/features/online/panels/MetricasPanel.tsx`
- Modify: `apps/web-admin/src/features/online/OnlineMediaUpload.tsx`
- Modify: `apps/web-admin/src/features/online/QrScanOverlay.tsx`
- Modify: `apps/web-admin/src/features/online/SalesProductPicker.tsx`
- Modify: `apps/web-admin/src/features/online/OnlineKitchenTicket.tsx`
- Modify: `apps/web-admin/src/features/online/components/OnlineSettingsPanel.tsx`

**Interfaces:**
- Consumes de Task 2: `onlineCardClass`, `OnlinePanelShell` con `subtitle`/`actions`, `onlineFieldClass`, `onlineButtonClass`.
- Produces: nada.

- [ ] **Step 1: Aplicar el pase mecánico (mismas 5 reglas de Task 4, con prefijo `online`) a cada archivo**

Reemplazos de helper: `rounded-xl border border-border bg-card p-N` → `${onlineCardClass('p-N')}`; agregar `onlineCardClass` al import de `../online-shared` (o `./online-shared` según el archivo) donde se use.

Subtítulos en `<OnlinePanelShell title="...">`:
- OnlineInicioPanel → `subtitle="Estado general de las ventas por la web"`
- CocinaOnlinePanel → `subtitle="Pedidos web en preparación"`
- MenuWebPanel → `subtitle="Productos y secciones visibles en la carta web"`
- SponsorsPanel → `subtitle="Logos de sponsors en la web pública"`
- MetricasPanel → `subtitle="Indicadores de ventas online"`

- [ ] **Step 2: MetricasPanel / stat tiles**

En `MetricasPanel.tsx` líneas ~136, ~141 (`text-lg font-bold` de los valores de métrica): estos son valores de stat tile, no encabezados → **dejar** (o subir a `text-2xl font-bold` para igualar a `FutbolInicioPanel`). Igualar el contenedor de cada tile a `${onlineCardClass('p-4')}`.

- [ ] **Step 3: QrScanOverlay / SalesProductPicker / OnlineKitchenTicket / OnlineMediaUpload**

Solo reglas 2 y 4 (radios de controles a `rounded-lg`, colores de marca al hex). `OnlineKitchenTicket` es un ticket imprimible: si tiene estilos pensados para impresión (`print:`), no tocar esos; solo el preview en pantalla.

- [ ] **Step 4: Typecheck + tests**

Run: `npx tsc --noEmit -p apps/web-admin && npm run test:admin`
Expected: PASS.

- [ ] **Step 5: Verificación visual**

Browser: `/online?tab=inicio`, `tab=cocina`, `tab=menu`, `tab=sponsors`, `tab=metricas`. Claro y oscuro. Probar el overlay de escaneo QR (abrir/cerrar). Screenshot de cocina y métricas.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/features/online
git commit -m "style(online): alinear paneles del modulo a la estetica del admin"
```

---

### Task 7: QA visual final y limpieza

**Files:**
- Ninguno nuevo salvo correcciones puntuales detectadas.

**Interfaces:** N/A.

- [ ] **Step 1: Grep de restos**

Run:
```bash
grep -rn "rounded-2xl\|bg-input-background\|text-primary-foreground\|bg-primary\b\|text-lg font-bold" apps/web-admin/src/features/futbol apps/web-admin/src/features/online
```
Expected: sin resultados de color/marca. `rounded-2xl` → cero. Si aparece algo legítimo (p. ej. un contenedor grande que sí debe ser `rounded-xl`), corregir a `rounded-xl` o justificar en el commit.

- [ ] **Step 2: Build de producción**

Run: `npm run build:admin`
Expected: build OK sin warnings nuevos.

- [ ] **Step 3: Recorrida completa lado a lado**

Dev server. Abrir en pestañas: `/almacenes` (referencia), `/futbol?tab=inicio`, `/online?tab=inicio`. Verificar en claro y oscuro:
- `<h1>` mismo tamaño/peso.
- Botones primarios: mismo verde, mismo `rounded-lg`, misma sombra.
- Inputs: mismo fondo `bg-card`, mismo ring de foco verde.
- Sin doble borde alrededor del contenido.
- Cards con `shadow-sm` y `rounded-xl`.

- [ ] **Step 4: Screenshots finales para el usuario**

Capturar `/futbol?tab=equipos` y `/online?tab=metricas` en claro y oscuro y enviarlas con `SendUserFile`.

- [ ] **Step 5: Commit (si hubo correcciones) y cierre**

```bash
git add -A
git commit -m "style(futbol,online): correcciones finales del pase estetico"
```

Si no hubo cambios, saltear el commit.

---

## Self-Review

**1. Cobertura del diseño:**
- Encabezados `<h1>` + subtítulo + acciones → Task 1/2 (Shell) + subtítulos en Tasks 4-6. ✓
- Radios `rounded-lg` en controles → regla 2, Tasks 4-6; verificación en Task 7 grep. ✓
- Botón primario (icono + padding + shadow + hover) → Task 1/2 `buttonClass`. ✓
- Inputs `bg-card` + ring verde → Task 1/2 `fieldClass`. ✓
- Quitar caja exterior del módulo → Task 3. ✓
- Verde fijo en dark (decisión del usuario) → Global Constraints + regla 4. ✓
- No tocar archivos del admin → Global Constraints + mapa de archivos. ✓

**2. Placeholders:** Los subtítulos son texto real provisto. Las "reglas del pase" son find/replace concretas, no "manejar edge cases". No hay TODO/TBD. Las tasks 5/6 dicen "leer el archivo y aplicar 5 reglas" — es mecánico y las reglas están enumeradas con valores exactos; aceptable para un pase cosmético.

**3. Consistencia de tipos:**
- `futbolCardClass` / `onlineCardClass`: firma `(extra = '') => string`, misma forma que `fieldClass`. ✓
- `FutbolPanelShell` / `OnlinePanelShell`: props `title` (req), `subtitle?`, `actions?`, `children` (req) — idénticas en ambos. ✓
- `onlineButtonClass` gana segundo parámetro `extra` para igualar a `futbolButtonClass`. Retrocompatible. ✓

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-09-08-futbol-online-estetica-admin.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** - execute tasks in this session using executing-plans, batch execution with checkpoints.

**Which approach?**
