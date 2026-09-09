# Web pública: cantina, sponsors y bugs visuales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer usable de punta a punta el flujo público de cantina (menú que respeta stock → carrito → confirmar sin tarjeta → QR de retiro) y los sponsors (dos slots fijos con carrusel RTL), y corregir los bugs visuales de layout móvil y estados de error.

**Architecture:** El menú y el checkout públicos reusan los helpers de stock del mostrador (`sales-stock.ts`, `SalesService.checkout`) para no divergir. El pedido público nace `listo` y sigue generando `OrdenCocina` para el KDS. Los sponsors pasan a tener dos `placement` de primera clase (`home` / `cantina`) con `durationSeconds`, y un componente `SponsorCarousel` en el cliente reemplaza cuatro banners duplicados y borra sidebar/footer de sponsors. Los arreglos visuales son safe-area, z-index, guards de video y estados `isError` en las queries.

**Tech Stack:** NestJS + Prisma (Postgres) en `apps/api`; React 19 + Vite + Tailwind v4 + TanStack Query + React Router (HashRouter) en `apps/web-public`; React + Vite en `apps/web-admin`. Tests con Vitest (`test/db/**` = Postgres real vía `testPrisma()`; resto = node/jsdom).

**Spec:** [`docs/superpowers/specs/2026-09-09-web-publica-cantina-sponsors-design.md`](../specs/2026-09-09-web-publica-cantina-sponsors-design.md) — el plan argumenta desde el spec; los ejecutores leen ambos.

## Global Constraints

- **Todo el texto visible al usuario va en español.** Mensajes de error de API incluidos.
- **`durationSeconds`**: entero **2–60 inclusive**. Default **5** si viene vacío/ausente.
- **No se construye integración de pagos.** Nada de formularios de tarjeta, billetera, Mercado Pago, tokens de pago.
- **No se borran valores del enum `PlacementPatrocinador`** (`banner`, `sidebar`, `footer` quedan muertos pero presentes).
- **El pedido público nace `status: 'listo'`** (no `en_cocina`, no `pendiente_pago`).
- **El pedido público sigue creando `OrdenCocina`** y linkeándola (`pedidoPublicoId`). El KDS del admin no se toca.
- **Estados públicos del pedido visibles**: solo **Para retirar** y **Retirado** (más los legados que se mapean a "Para retirar").
- **Carrusel de sponsors**: rota **RTL** (el nuevo entra desde la derecha). `prefers-reduced-motion: reduce` → sin animación, muestra el primero.
- **Productos agotados no se muestran** en el menú: se filtran en el servidor, no se envía `disponible: false`.
- **Reusar** `loadSalesProductsForStock` + `buildRequiredByStockProduct` de `apps/api/src/sales/sales-stock.ts`. No reimplementar el cálculo de receta.
- No borrar código legado no montado (`store.ts`, `client.ts`, `adapters.ts`, `PublicAppContext.tsx`). No migrar el sitio a `Button`/`Card`.
- Tests de `apps/api`: `npm --prefix apps/api test` (node) y `npm --prefix apps/api run test:db` (Postgres). Tests de front: `npm --prefix apps/web-public test`, `npm --prefix apps/web-admin test`.
- Commits: mensaje en español, terminar con `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.

---

## File Structure

### Nuevos archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/api/src/public/menu-availability.ts` | Función pura: dado el mapa de productos de venta y el stock disponible por `stockProductId`, decidir si un ítem del menú tiene stock para ≥1 unidad. |
| `apps/api/src/public/public-order-errors.ts` | Traducir el `ConflictException` de stock de `SalesService` a un mensaje 409 en español con los nombres de las líneas afectadas. |
| `apps/api/src/sponsors/dto/sponsor.dto.ts` | DTOs `CreateSponsorDto` / `UpdateSponsorDto` con `class-validator` (incluye `durationSeconds` 2–60). |
| `apps/api/prisma/migrations/<ts>_sponsors_home_cantina_placement/migration.sql` | Enum `home`/`cantina`, columna `duration_seconds`, migración de datos de filas existentes. |
| `apps/api/test/db/public-menu-availability.test.ts` | Tests Postgres de `listMenu` (omite/incluye por stock, promo agotada). |
| `apps/api/test/db/public-checkout.test.ts` | Tests Postgres de checkout público (`visibleWeb:false` → 400; crea pedido `listo`; 409 en español). |
| `apps/api/test/db/public-sponsors.test.ts` | Tests Postgres de `listSponsors` (no devuelve sidebar/footer/inactivos) y validación `durationSeconds`. |
| `apps/web-public/src/app/components/public/SafeImage.tsx` | `<img>` con `onError` → placeholder, `object-cover`, `alt` con el nombre. |
| `apps/web-public/src/app/components/public/cart/reconcile-cart.ts` | Función pura: quitar del carrito las líneas cuyo `id` ya no está en el menú. |
| `apps/web-public/src/app/components/public/cart/reconcile-cart.test.ts` | Test de `reconcileCart`. |
| `apps/web-public/src/app/components/public/sponsors/sponsor-carousel-model.ts` | Funciones puras: ordenar sponsors de un slot y calcular el avance/dwell del carrusel. |
| `apps/web-public/src/app/components/public/sponsors/sponsor-carousel-model.test.ts` | Tests del modelo del carrusel (0/1/N ítems, orden, dwell). |
| `apps/web-public/src/app/components/public/sponsors/SponsorCarousel.tsx` | Componente de carrusel RTL (imagen o video), consume el modelo puro. |
| `apps/web-public/src/app/components/public/QueryError.tsx` | Bloque de error reutilizable (mensaje + botón "Reintentar"). |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/api/src/public/public.service.ts` | `listMenu()` filtra por stock; `listSponsors()` filtra `placement in (home,cantina)` y devuelve `durationSeconds`. |
| `apps/api/src/public/public-orders.service.ts` | Guard `visibleWeb`; traducción del 409; `status: 'listo'` en la creación. |
| `apps/api/src/sponsors/sponsors.service.ts` | Aceptar/validar `durationSeconds`; tipos. |
| `apps/api/src/sponsors/sponsors.controller.ts` | Usar los DTOs nuevos. |
| `apps/api/prisma/schema.prisma` | Enum `PlacementPatrocinador` + `home`/`cantina`; `Patrocinador.durationSeconds`. |
| `apps/web-public/src/styles/tailwind.css` | Utilidades `safe-top`/`safe-bottom` ya existen; agregar `safe-x` si hace falta y un helper de `min-height` para el nav. |
| `apps/web-public/src/app/api/public-api.ts` | `PublicSponsor.durationSeconds`; sin cambios de firma en `orders.checkout`. |
| `apps/web-public/src/app/components/public/PublicLayout.tsx` | Safe-area en header/nav; borrar `FooterSponsors`/`MobileFooterSponsors`/`SidebarSponsors`. |
| `apps/web-public/src/app/components/public/pages/CantinaPage.tsx` | FAB sobre el nav; `SafeImage`; `SponsorCarousel slot="cantina"`; revalidar carrito; borrar `CantinaPromoBanner`. |
| `apps/web-public/src/app/components/public/pages/CartPage.tsx` | Borrar `serviceFee`; `SafeImage`; revalidar carrito al montar; `line-clamp`. |
| `apps/web-public/src/app/components/public/pages/PaymentPage.tsx` | Reescribir: sin tarjeta ni billetera; "pagás al retirar"; CTA "Confirmar pedido". |
| `apps/web-public/src/app/components/public/pages/OrdersPage.tsx` | Estados `listo`→"Para retirar"; manejar `isError`. |
| `apps/web-public/src/app/components/public/pages/QrPage.tsx` | Manejar `isError` sin empty-state mentiroso. |
| `apps/web-public/src/app/components/public/pages/HomePage.tsx` | `SponsorCarousel slot="home"`; manejar `isError`; borrar `SponsorBanner`; guard de video en la galería. |
| `apps/web-public/src/app/components/public/pages/FotosPage.tsx` | Lightbox: `<video controls>` si `type === 'video'`. |
| `apps/web-public/src/app/components/public/pages/ProfilePage.tsx` | Borrar toda la sección "Medios de Pago" y `lch_public_saved_cards`. |
| `apps/web-public/src/app/components/public/SponsorPlacements.tsx` | Borrar `SidebarSponsors`/`FooterSponsors`/`MobileFooterSponsors` (dejar `usePublicSponsors` si se sigue usando; si no, borrar el archivo). |
| `apps/web-admin/src/features/online/sponsor-placements.ts` | Dejar solo `home` y `cantina`, con `placement` real. |
| `apps/web-admin/src/features/online/panels/SponsorsPanel.tsx` | Campo `durationSeconds`; mapear placement real. |
| `apps/web-admin/src/app/api/client.ts` | `Sponsor.durationSeconds`; `Create/UpdateSponsorPayload.durationSeconds`. |

---

## Task 1: Utilidades de safe-area y `QueryError`

**Files:**
- Modify: `apps/web-public/src/styles/tailwind.css`
- Create: `apps/web-public/src/app/components/public/QueryError.tsx`

**Interfaces:**
- Consumes: nada.
- Produces:
  - Clases CSS `safe-top`, `safe-bottom` (ya existen), y `nav-safe-bottom` (nueva): `padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px))`.
  - `QueryError({ message, onRetry }: { message: string; onRetry?: () => void }): JSX.Element`.

- [ ] **Step 1: Agregar la utilidad de nav a `tailwind.css`**

Al final de `apps/web-public/src/styles/tailwind.css`, después del bloque `.safe-bottom`:

```css
.nav-safe-bottom {
  padding-bottom: calc(0.5rem + env(safe-area-inset-bottom, 0px));
}

.fab-above-nav {
  bottom: calc(5rem + env(safe-area-inset-bottom, 0px));
}
```

- [ ] **Step 2: Crear `QueryError.tsx`**

```tsx
type Props = {
  message: string;
  onRetry?: () => void;
};

export function QueryError({ message, onRetry }: Props) {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-md rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm font-semibold text-red-300">No pudimos cargar esta sección.</p>
        <p className="mt-1 text-xs text-red-300/80">{message}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-xl bg-lch-accent px-5 py-2.5 text-xs font-black text-[#0e0e0e]"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npm --prefix apps/web-public run build`
Expected: build OK (sin errores de TS por el componente nuevo).

- [ ] **Step 4: Commit**

```bash
git add apps/web-public/src/styles/tailwind.css apps/web-public/src/app/components/public/QueryError.tsx
git commit -m "feat(web-publica): utilidades safe-area del nav y bloque QueryError reutilizable"
```

---

## Task 2: `SafeImage`

**Files:**
- Create: `apps/web-public/src/app/components/public/SafeImage.tsx`

**Interfaces:**
- Consumes: nada.
- Produces: `SafeImage(props: { src?: string | null; alt: string; className?: string; fallbackLabel?: string }): JSX.Element` — renderiza `<img object-cover>`; ante `onError` o `src` vacío muestra un placeholder con `fallbackLabel ?? alt`.

- [ ] **Step 1: Crear el componente**

```tsx
import { useState } from 'react';

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackLabel?: string;
};

export function SafeImage({ src, alt, className, fallbackLabel }: Props) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        className={`flex items-center justify-center bg-[#161616] px-2 text-center text-[10px] font-bold text-gray-500 ${className ?? ''}`}
      >
        {fallbackLabel ?? alt}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? ''}`}
    />
  );
}
```

- [ ] **Step 2: Verificar que compila**

Run: `npm --prefix apps/web-public run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add apps/web-public/src/app/components/public/SafeImage.tsx
git commit -m "feat(web-publica): componente SafeImage con placeholder ante error de carga"
```

---

## Task 3: Shell móvil — safe-area, FAB y doble header

**Files:**
- Modify: `apps/web-public/src/app/components/public/PublicLayout.tsx`
- Modify: `apps/web-public/src/app/components/public/pages/CantinaPage.tsx:338-358` (FAB)
- Modify: `apps/web-public/src/app/components/public/auth/DniModal.tsx`

**Interfaces:**
- Consumes: clases de Task 1 (`nav-safe-bottom`, `fab-above-nav`).
- Produces: nada nuevo para otras tareas.

- [ ] **Step 1: Safe-area en el header y el nav de `PublicLayout.tsx`**

En `apps/web-public/src/app/components/public/PublicLayout.tsx`:

- Header móvil (`<header ... className="flex items-center justify-between px-4 py-3 md:hidden">`): añadir `safe-top` a la className.
- Nav inferior (`<nav ... className="fixed bottom-0 left-0 right-0 z-30 md:hidden">`): añadir `nav-safe-bottom` a la className y subir el z-index a `z-40`.
- El `<main>` tiene `pb-20`; cambiarlo a `pb-24` para dejar aire sobre el nav con safe-area.

- [ ] **Step 2: FAB del carrito sobre el nav en `CantinaPage.tsx`**

Reemplazar el contenedor del FAB (`<div className="fixed bottom-6 right-6 z-30">`) por:

```tsx
<div className="fab-above-nav fixed right-6 z-40 md:bottom-6">
```

(en `md:` el nav no existe, así que `bottom-6` desktop; en móvil manda `fab-above-nav`).

- [ ] **Step 3: Safe-area en `DniModal`**

En `apps/web-public/src/app/components/public/auth/DniModal.tsx`, al contenedor raíz del overlay (el `fixed inset-0 ...`) añadir `safe-top safe-bottom` a su className. Si ya centra con fl* y padding, sólo añadir las clases; no cambiar la estructura.

- [ ] **Step 4: Verificación en navegador (móvil)**

```bash
npm --prefix apps/web-public run dev
```

Con la Browser pane en viewport móvil (375×812, `resize_window` preset `mobile`), navegar a `/#/cantina`:
- El header verde de arriba no queda tapado por el notch simulado (hay `padding-top`).
- Con ítems en el carrito, el FAB "N items" queda **por encima** de la barra de navegación inferior y es clickeable.
- El nav inferior no queda pegado al borde inferior en un dispositivo con `safe-area` (se puede forzar con DevTools device toolbar / iPhone).

Adjuntar screenshot del estado con carrito lleno en `/#/cantina`.

- [ ] **Step 5: Commit**

```bash
git add apps/web-public/src/app/components/public/PublicLayout.tsx apps/web-public/src/app/components/public/pages/CantinaPage.tsx apps/web-public/src/app/components/public/auth/DniModal.tsx
git commit -m "fix(web-publica): safe-area en header/nav/modal y FAB del carrito por encima del nav"
```

---

## Task 4: Lightbox de fotos y galería — guards de video

**Files:**
- Modify: `apps/web-public/src/app/components/public/pages/FotosPage.tsx:1359-1390` (lightbox)
- Modify: `apps/web-public/src/app/components/public/pages/HomePage.tsx:1878-1901` (galería del home)

**Interfaces:**
- Consumes: `SafeImage` (Task 2).
- Produces: nada.

- [ ] **Step 1: Lightbox de `FotosPage` con `<video>` para videos**

En el bloque `{lightboxItem && ( ... )}`, reemplazar el `<img src={lightboxItem.url} ... />` por:

```tsx
{lightboxItem.type === 'video' ? (
  <video
    src={lightboxItem.url}
    controls
    playsInline
    autoPlay
    className="max-h-[70vh] w-full rounded-2xl bg-black object-contain"
  />
) : (
  <SafeImage
    src={lightboxItem.url}
    alt={lightboxItem.title}
    className="max-h-[70vh] w-full rounded-2xl"
    fallbackLabel={lightboxItem.title}
  />
)}
```

Añadir `import { SafeImage } from '../SafeImage';` arriba.

- [ ] **Step 2: Galería del Home — no usar `<img>` para videos**

En `HomePage.tsx`, en el grid de `mediaItems.slice(0, 3)`, el `<img src={item.url} ...>` sólo aplica a fotos. Como los placeholders no tienen `type`, tratarlos como foto. Para ítems reales:

```tsx
{'type' in item && (item as { type?: string }).type === 'video' ? (
  <div className="flex h-full w-full items-center justify-center bg-[#161616]">
    <span style={{ color: '#6BFF9E' }}><IconVideo /></span>
  </div>
) : (
  <SafeImage src={item.url} alt={item.title} className="h-full w-full" fallbackLabel={item.title} />
)}
```

Importar `IconVideo` desde `'../figma-icons'` (ya se importan otros iconos de ahí) y `SafeImage`.

- [ ] **Step 3: Verificación en navegador**

Con el dev server corriendo y al menos un medio `type: 'video'` en la base (o seed de demo), navegar a `/#/fotos`:
- La miniatura de un video muestra el ícono de video (ya lo hacía).
- Al abrir el lightbox de un video, se ve un `<video>` con controles reproducible, **no** un `<img>` roto.
- En `/#/` (home), la tira "Fotos & Videos del finde" no muestra un `<img>` roto para un ítem de video.

Adjuntar screenshot del lightbox de video abierto.

- [ ] **Step 4: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/FotosPage.tsx apps/web-public/src/app/components/public/pages/HomePage.tsx
git commit -m "fix(web-publica): reproducir videos en el lightbox de fotos y en la galeria del home"
```

---

## Task 5: Estados de error en queries (`OrdersPage`, `QrPage`, `HomePage`)

**Files:**
- Modify: `apps/web-public/src/app/components/public/pages/OrdersPage.tsx`
- Modify: `apps/web-public/src/app/components/public/pages/QrPage.tsx`
- Modify: `apps/web-public/src/app/components/public/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `QueryError` (Task 1).
- Produces: nada.

- [ ] **Step 1: `OrdersPage` — distinguir error de "sin pedidos"**

En el `useQuery` de `['public-orders', token]`, desestructurar también `isError`, `error`, `refetch`. Después del check `if (isLoading) return <PageLoader />;` agregar:

```tsx
if (isError) {
  return (
    <div className="space-y-5 p-6" style={{ maxWidth: 780, margin: '0 auto' }}>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-lch-accent">Cantina</p>
        <h1 className="text-2xl font-black text-white">Mis Pedidos</h1>
      </div>
      <QueryError message={(error as Error)?.message ?? 'Error de red'} onRetry={() => void refetch()} />
    </div>
  );
}
```

Importar `QueryError` desde `'../QueryError'`.

- [ ] **Step 2: `QrPage` — no mostrar "No hay pedido activo" si la request falló**

En el `useQuery` de `['public-order-qr', ...]` desestructurar `isError`, `error`, `refetch`. Antes del bloque `if (!displayOrder?.qr) { ... }`:

```tsx
if (isError && !displayOrder) {
  return <QueryError message={(error as Error)?.message ?? 'Error de red'} onRetry={() => void refetch()} />;
}
```

Importar `QueryError` desde `'../QueryError'`.

- [ ] **Step 3: `HomePage` — manejar el error del `home-bundle`**

En el `useQuery` de `['home-bundle']` desestructurar `isError`, `error`, `refetch`. Después de `if (isLoading) return <PageLoader />;`:

```tsx
if (isError) {
  return <QueryError message={(error as Error)?.message ?? 'Error de red'} onRetry={() => void refetch()} />;
}
```

Importar `QueryError` desde `'../QueryError'`.

- [ ] **Step 4: Verificación en navegador**

Con el dev server corriendo, detener `apps/api` (o bloquear `/public` en la Browser pane con `read_network_requests` no aplica — simplemente parar la API). Navegar a `/#/pedidos`, `/#/qr`, `/#/`:
- Cada una muestra el bloque rojo "No pudimos cargar esta sección" con botón "Reintentar", **no** "Todavía no hiciste pedidos" ni "No hay pedido activo con codigo QR".
- Al reanudar la API y tocar "Reintentar", cargan normalmente.

Adjuntar screenshot de `/#/pedidos` en estado de error.

- [ ] **Step 5: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/OrdersPage.tsx apps/web-public/src/app/components/public/pages/QrPage.tsx apps/web-public/src/app/components/public/pages/HomePage.tsx
git commit -m "fix(web-publica): estados de error explicitos en pedidos, QR y home"
```

---

## Task 6: API — disponibilidad del menú (`listMenu`)

**Files:**
- Create: `apps/api/src/public/menu-availability.ts`
- Modify: `apps/api/src/public/public.service.ts:364-405` (`listMenu`)
- Test: `apps/api/test/db/public-menu-availability.test.ts`

**Interfaces:**
- Consumes: `loadSalesProductsForStock`, `buildRequiredByStockProduct`, `SalesProductForStock` de `apps/api/src/sales/sales-stock.ts`.
- Produces:
  - `menuItemHasStock(salesProductId: string, spMap: Map<string, SalesProductForStock>, availableByStockProduct: Map<string, number>): boolean` — `false` si la receta no es resoluble (simple sin receta, promo sin componentes, ciclo) o si algún insumo requerido > disponible.
  - `listMenu()` mantiene su forma de respuesta (`{ items, categories, filters }`); `items` sólo excluye ítems sin stock.

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/db/public-menu-availability.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { PublicService } from '../../src/public/public.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';
import type { ReglamentoEngineService } from '../../src/reglamento/reglamento-engine.service';

const prisma = testPrisma();
const service = new PublicService(
  prisma as unknown as PrismaService,
  {} as unknown as ReglamentoEngineService,
);

async function seedMenu() {
  const cat = await prisma.categoria.create({ data: { name: 'Insumos' } });
  const dep = await prisma.deposito.create({ data: { name: 'Principal', location: 'C' } });
  const cocina = await prisma.cocina.create({ data: { name: 'Parrilla' } });
  const catVenta = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
  const pan = await prisma.producto.create({ data: { name: 'Pan', code: 'P-1', categoryId: cat.id } });
  const medallon = await prisma.producto.create({ data: { name: 'Medallón', code: 'P-2', categoryId: cat.id } });
  return { dep, cocina, catVenta, pan, medallon };
}

describe('PublicService.listMenu — disponibilidad por stock (Postgres real)', () => {
  beforeEach(async () => { await resetTestDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('omite un simple cuya receta pide más stock del disponible', async () => {
    const { dep, cocina, catVenta, pan } = await seedMenu();
    await prisma.nivelStock.create({ data: { productId: pan.id, warehouseId: dep.id, quantity: 0 } });
    const hamburguesa = await prisma.productoVenta.create({
      data: { name: 'Hamburguesa', categoriaVentaId: catVenta.id, kitchenId: cocina.id, price: 8000, active: true, visibleWeb: true },
    });
    await prisma.itemReceta.create({ data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 } });

    const menu = await service.listMenu();
    expect(menu.items.find((i) => i.id === hamburguesa.id)).toBeUndefined();
  });

  it('incluye el mismo ítem cuando hay stock', async () => {
    const { dep, cocina, catVenta, pan } = await seedMenu();
    await prisma.nivelStock.create({ data: { productId: pan.id, warehouseId: dep.id, quantity: 10 } });
    const hamburguesa = await prisma.productoVenta.create({
      data: { name: 'Hamburguesa', categoriaVentaId: catVenta.id, kitchenId: cocina.id, price: 8000, active: true, visibleWeb: true },
    });
    await prisma.itemReceta.create({ data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 } });

    const menu = await service.listMenu();
    expect(menu.items.find((i) => i.id === hamburguesa.id)).toBeDefined();
  });

  it('omite una promo si un componente está agotado', async () => {
    const { dep, cocina, catVenta, pan, medallon } = await seedMenu();
    await prisma.nivelStock.create({ data: { productId: pan.id, warehouseId: dep.id, quantity: 10 } });
    await prisma.nivelStock.create({ data: { productId: medallon.id, warehouseId: dep.id, quantity: 0 } });
    const hamburguesa = await prisma.productoVenta.create({
      data: { name: 'Hamburguesa', categoriaVentaId: catVenta.id, kitchenId: cocina.id, price: 8000, active: true, visibleWeb: true, kind: 'simple' },
    });
    await prisma.itemReceta.create({ data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 } });
    await prisma.itemReceta.create({ data: { salesProductId: hamburguesa.id, stockProductId: medallon.id, quantity: 1 } });
    const combo = await prisma.productoVenta.create({
      data: { name: 'Combo', categoriaVentaId: catVenta.id, kitchenId: cocina.id, price: 12000, active: true, visibleWeb: true, kind: 'promo' },
    });
    await prisma.itemComboVenta.create({ data: { promoProductId: combo.id, componentProductId: hamburguesa.id, quantity: 1 } });

    const menu = await service.listMenu();
    expect(menu.items.find((i) => i.id === combo.id)).toBeUndefined();
    expect(menu.items.find((i) => i.id === hamburguesa.id)).toBeUndefined();
  });
});
```

> Modelos Prisma reales (verificado en `schema.prisma`): receta = `ItemReceta` (relación `recipe` en `ProductoVenta`, accessor `prisma.itemReceta`); promo = `ItemComboVenta` (relación `bundleItems`, accessor `prisma.itemComboVenta`, campos `promoProductId` / `componentProductId` / `quantity`). `ProductoVenta.kind` es `'simple' | 'promo'`.

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npm --prefix apps/api run test:db -- public-menu-availability`
Expected: FALLA — el primer y tercer test fallan porque hoy `listMenu` no filtra por stock.

- [ ] **Step 3: Escribir `menu-availability.ts`**

```ts
import { ConflictException } from '@nestjs/common';
import {
  buildRequiredByStockProduct,
  type SalesProductForStock,
} from '../sales/sales-stock';

/**
 * ¿El ítem del menú tiene stock para al menos 1 unidad?
 * Devuelve false si la receta no es resoluble (simple sin receta, promo sin
 * componentes, ciclo) o si algún insumo requerido supera el disponible.
 */
export function menuItemHasStock(
  salesProductId: string,
  spMap: Map<string, SalesProductForStock>,
  availableByStockProduct: Map<string, number>,
): boolean {
  const sp = spMap.get(salesProductId);
  if (!sp) return false;
  if (sp.kind !== 'promo' && sp.recipe.length === 0) return false;

  let required: Record<string, number>;
  try {
    required = buildRequiredByStockProduct([{ salesProductId, quantity: 1 }], spMap);
  } catch (err) {
    if (err instanceof ConflictException) return false;
    throw err;
  }

  const entries = Object.entries(required);
  if (entries.length === 0) return false;

  for (const [stockProductId, need] of entries) {
    const available = availableByStockProduct.get(stockProductId) ?? 0;
    if (available < need) return false;
  }
  return true;
}
```

- [ ] **Step 4: Cablear `listMenu` en `public.service.ts`**

Añadir imports arriba del archivo:

```ts
import { loadSalesProductsForStock } from '../sales/sales-stock';
import { menuItemHasStock } from './menu-availability';
```

Dentro de `listMenu()`, después de traer `items` (y antes del `return`), reemplazar el `items.map(...)` para que primero filtre:

```ts
const spMap = await loadSalesProductsForStock(this.prisma, items.map((i) => i.id));

const levels = await this.prisma.nivelStock.groupBy({
  by: ['productId'],
  _sum: { quantity: true },
});
const availableByStockProduct = new Map<string, number>(
  levels.map((l) => [l.productId, Number(l._sum.quantity ?? 0)]),
);

const availableItems = items.filter((item) =>
  menuItemHasStock(item.id, spMap, availableByStockProduct),
);

return {
  items: availableItems.map((item) => ({
    // ...igual que hoy, cambiando `items.map` por `availableItems.map`
  })),
  categories,
  filters,
};
```

(Categorías y filtros se devuelven completos, sin cambios.)

- [ ] **Step 5: Correr el test — debe pasar**

Run: `npm --prefix apps/api run test:db -- public-menu-availability`
Expected: PASA (3/3).

- [ ] **Step 6: Correr toda la suite db para no romper nada**

Run: `npm --prefix apps/api run test:db`
Expected: PASA.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/public/menu-availability.ts apps/api/src/public/public.service.ts apps/api/test/db/public-menu-availability.test.ts
git commit -m "feat(api): el menu publico omite items sin stock para una unidad"
```

---

## Task 7: API — checkout público (`visibleWeb`, 409 en español, pedido `listo`)

**Files:**
- Create: `apps/api/src/public/public-order-errors.ts`
- Modify: `apps/api/src/public/public-orders.service.ts:23-104`
- Test: `apps/api/test/db/public-checkout.test.ts`

**Interfaces:**
- Consumes: `SalesService.checkout` (devuelve `{ ok, ticket, idempotent }`); `ConflictException` de stock con forma `{ message: 'Insufficient stock for checkout', missing: Array<{ stockProductId, required, available }> }`; `loadSalesProductsForStock`, `buildRequiredByStockProduct`.
- Produces:
  - `translateStockConflict(missing: Array<{ stockProductId: string }>, lines: Array<{ salesProductId: string; name: string }>, spMap: Map<string, SalesProductForStock>): string` — mensaje `'No hay stock suficiente para: <nombres>'`.
  - `PublicOrdersService.checkout` sigue devolviendo `formatOrder(...)` con `status: 'listo'`.

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/db/public-checkout.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PublicOrdersService } from '../../src/public/public-orders.service';
import { SalesService } from '../../src/sales/sales.service';
import { StockMovementsService } from '../../src/stock/stock-movements.service';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';

const prisma = testPrisma();
const prismaAsService = prisma as unknown as PrismaService;
const movements = new StockMovementsService(prismaAsService);
const sales = new SalesService(prismaAsService, movements);
const sse = { broadcastKitchenEvent: () => {} } as never;
const orders = new PublicOrdersService(prismaAsService, sales, sse);

async function seed(opts: { stock: number; visibleWeb: boolean }) {
  await prisma.usuario.create({ data: { username: 'online', name: 'Online', role: 'Vendedor', password: 'x' } });
  const cuenta = await prisma.cuentaPublica.create({ data: { email: 'socio@lch.test', passwordHash: 'h' } });
  const cat = await prisma.categoria.create({ data: { name: 'Insumos' } });
  const dep = await prisma.deposito.create({ data: { name: 'Principal', location: 'C' } });
  const cocina = await prisma.cocina.create({ data: { name: 'Parrilla' } });
  const catVenta = await prisma.categoriaVenta.create({ data: { name: 'Comidas' } });
  const pan = await prisma.producto.create({ data: { name: 'Pan de hamburguesa', code: 'P-1', categoryId: cat.id } });
  await prisma.nivelStock.create({ data: { productId: pan.id, warehouseId: dep.id, quantity: opts.stock } });
  const hamburguesa = await prisma.productoVenta.create({
    data: { name: 'Hamburguesa', categoriaVentaId: catVenta.id, kitchenId: cocina.id, price: 8000, active: true, visibleWeb: opts.visibleWeb },
  });
  await prisma.itemReceta.create({ data: { salesProductId: hamburguesa.id, stockProductId: pan.id, quantity: 1 } });
  return { cuenta, hamburguesa };
}

describe('PublicOrdersService.checkout (Postgres real)', () => {
  beforeEach(async () => { await resetTestDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('rechaza con 400 un producto visibleWeb:false aunque esté activo', async () => {
    const { cuenta, hamburguesa } = await seed({ stock: 10, visibleWeb: false });
    await expect(
      orders.checkout(cuenta.id, { items: [{ salesProductId: hamburguesa.id, quantity: 1 }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crea el PedidoPublico con status "listo"', async () => {
    const { cuenta, hamburguesa } = await seed({ stock: 10, visibleWeb: true });
    const order = await orders.checkout(cuenta.id, { items: [{ salesProductId: hamburguesa.id, quantity: 1 }] });
    expect(order.status).toBe('listo');
    const row = await prisma.pedidoPublico.findUnique({ where: { id: order.id } });
    expect(row?.status).toBe('listo');
    const cocinas = await prisma.ordenCocina.findMany({ where: { pedidoPublicoId: order.id } });
    expect(cocinas.length).toBeGreaterThan(0);
  });

  it('traduce el 409 de stock a español con el nombre de la línea', async () => {
    const { cuenta, hamburguesa } = await seed({ stock: 0, visibleWeb: true });
    await expect(
      orders.checkout(cuenta.id, { items: [{ salesProductId: hamburguesa.id, quantity: 1 }] }),
    ).rejects.toMatchObject({
      response: { message: 'No hay stock suficiente para: Hamburguesa' },
    });
  });
});
```

- [ ] **Step 2: Correr el test — debe fallar**

Run: `npm --prefix apps/api run test:db -- public-checkout`
Expected: FALLA — hoy no hay guard `visibleWeb`, el pedido nace `en_cocina`, y el 409 sale en inglés.

- [ ] **Step 3: Escribir `public-order-errors.ts`**

```ts
import { buildRequiredByStockProduct, type SalesProductForStock } from '../sales/sales-stock';

/**
 * Convierte el `missing` del ConflictException de stock (ids de insumos internos)
 * en un mensaje en español con los nombres de las líneas del pedido afectadas.
 */
export function translateStockConflict(
  missing: Array<{ stockProductId: string }>,
  lines: Array<{ salesProductId: string; name: string }>,
  spMap: Map<string, SalesProductForStock>,
): string {
  const missingIds = new Set(missing.map((m) => m.stockProductId));
  const affected: string[] = [];
  for (const line of lines) {
    let required: Record<string, number>;
    try {
      required = buildRequiredByStockProduct([{ salesProductId: line.salesProductId, quantity: 1 }], spMap);
    } catch {
      required = {};
    }
    if (Object.keys(required).some((id) => missingIds.has(id))) {
      affected.push(line.name);
    }
  }
  const names = affected.length ? [...new Set(affected)].join(', ') : 'algunos productos';
  return `No hay stock suficiente para: ${names}`;
}
```

- [ ] **Step 4: Modificar `public-orders.service.ts`**

Imports:

```ts
import { loadSalesProductsForStock } from '../sales/sales-stock';
import { translateStockConflict } from './public-order-errors';
```

En `checkout(cuentaId, dto)`, **antes** de `this.sales.checkout(...)`:

```ts
const salesProductIds = [...new Set(dto.items.map((i) => i.salesProductId))];
const productos = await this.prisma.productoVenta.findMany({
  where: { id: { in: salesProductIds } },
  select: { id: true, name: true, active: true, visibleWeb: true },
});
const byId = new Map(productos.map((p) => [p.id, p]));
const noVendibles = salesProductIds.filter((id) => {
  const p = byId.get(id);
  return !p || !p.active || !p.visibleWeb;
});
if (noVendibles.length) {
  const nombres = noVendibles.map((id) => byId.get(id)?.name ?? id).join(', ');
  throw new BadRequestException(`Estos productos ya no están disponibles: ${nombres}`);
}
```

Envolver el `this.sales.checkout(...)` en try/catch para traducir el 409:

```ts
let checkoutResult;
try {
  checkoutResult = await this.sales.checkout({
    items: dto.items,
    operatorId,
    idempotencyKey: `ticket-${ticketKey}`,
    note: dto.nota ?? 'Pedido web cantina',
  });
} catch (err) {
  if (
    err instanceof ConflictException &&
    typeof err.getResponse() === 'object' &&
    Array.isArray((err.getResponse() as { missing?: unknown }).missing)
  ) {
    const missing = (err.getResponse() as { missing: Array<{ stockProductId: string }> }).missing;
    const spMap = await loadSalesProductsForStock(this.prisma, salesProductIds);
    const lines = dto.items.map((i) => ({
      salesProductId: i.salesProductId,
      name: byId.get(i.salesProductId)?.name ?? i.salesProductId,
    }));
    throw new ConflictException(translateStockConflict(missing, lines, spMap));
  }
  throw err;
}
```

En la creación del `pedidoPublico` (`tx.pedidoPublico.create`), cambiar `status: 'en_cocina'` por `status: 'listo'`.

- [ ] **Step 5: Correr el test — debe pasar**

Run: `npm --prefix apps/api run test:db -- public-checkout`
Expected: PASA (3/3).

- [ ] **Step 6: Suite completa db**

Run: `npm --prefix apps/api run test:db`
Expected: PASA. (Revisar `test/db/online-constraints.test.ts` y cualquier test de `online.service` que asuma `en_cocina` para pedidos web recién creados; si alguno lo asume, ajustarlo al nuevo contrato `listo` y notarlo en el commit.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/public/public-order-errors.ts apps/api/src/public/public-orders.service.ts apps/api/test/db/public-checkout.test.ts
git commit -m "feat(api): checkout publico exige visibleWeb, traduce el 409 y crea el pedido listo"
```

---

## Task 8: UI — carrito, revalidación y pantalla de pago

**Files:**
- Create: `apps/web-public/src/app/components/public/cart/reconcile-cart.ts`
- Create: `apps/web-public/src/app/components/public/cart/reconcile-cart.test.ts`
- Modify: `apps/web-public/src/app/components/public/pages/CartPage.tsx`
- Modify: `apps/web-public/src/app/components/public/pages/PaymentPage.tsx`
- Modify: `apps/web-public/src/app/components/public/pages/CantinaPage.tsx`

**Interfaces:**
- Consumes: `useCart()` (`items`, `replaceItems`), `publicApi.menu()`, `publicApi.orders.checkout(items, token, idempotencyKey)` (sin cambios de firma), `SafeImage`.
- Produces: `reconcileCart(lines: CartLine[], menuIds: Set<string>): { kept: CartLine[]; removedNames: string[] }`.

- [ ] **Step 1: Escribir el test de `reconcileCart`**

`apps/web-public/src/app/components/public/cart/reconcile-cart.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { reconcileCart } from './reconcile-cart';
import type { CartLine } from './CartContext';

const line = (id: string, name: string): CartLine =>
  ({ id, name, category: 'x', price: 100, kitchen: 'k', qty: 1 } as CartLine);

describe('reconcileCart', () => {
  it('mantiene las líneas que siguen en el menú', () => {
    const res = reconcileCart([line('a', 'A'), line('b', 'B')], new Set(['a', 'b']));
    expect(res.kept.map((l) => l.id)).toEqual(['a', 'b']);
    expect(res.removedNames).toEqual([]);
  });

  it('quita las líneas cuyo id ya no está y reporta sus nombres', () => {
    const res = reconcileCart([line('a', 'A'), line('b', 'B')], new Set(['a']));
    expect(res.kept.map((l) => l.id)).toEqual(['a']);
    expect(res.removedNames).toEqual(['B']);
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run: `npm --prefix apps/web-public test -- reconcile-cart`
Expected: FALLA (módulo no existe).

- [ ] **Step 3: Escribir `reconcile-cart.ts`**

```ts
import type { CartLine } from './CartContext';

export function reconcileCart(
  lines: CartLine[],
  menuIds: Set<string>,
): { kept: CartLine[]; removedNames: string[] } {
  const kept: CartLine[] = [];
  const removedNames: string[] = [];
  for (const line of lines) {
    if (menuIds.has(line.id)) kept.push(line);
    else removedNames.push(line.name);
  }
  return { kept, removedNames };
}
```

- [ ] **Step 4: Correr — debe pasar**

Run: `npm --prefix apps/web-public test -- reconcile-cart`
Expected: PASA (2/2).

- [ ] **Step 5: `CartPage` — borrar `serviceFee`, revalidar al montar, `SafeImage`**

- Borrar `const serviceFee = 0;` y la fila "Costo de Servicio" del resumen; el total pasa a ser `formatPrice(total)` (sin `+ serviceFee`).
- Reemplazar los dos `<img src={item.imageUrl ?? foodImageFor(...)}>` por `<SafeImage src={item.imageUrl} alt={item.name} className="h-full w-full" fallbackLabel={item.name} />` (dejar `foodImageFor` como fallback del `src`: `src={item.imageUrl ?? foodImageFor(item.name, item.category)}`).
- Al nombre del ítem (`<p className="font-bold text-white">`) añadir `line-clamp-1`.
- Revalidación: añadir

```tsx
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicApi } from '../../../api/public-api';
import { reconcileCart } from '../cart/reconcile-cart';
```

```tsx
const { items, total, add, remove, replaceItems } = useCart();
const { data: menu } = useQuery({ queryKey: ['menu'], queryFn: () => publicApi.menu() });

useEffect(() => {
  if (!menu) return;
  const ids = new Set(menu.items.map((i) => i.id));
  const { kept, removedNames } = reconcileCart(items, ids);
  if (removedNames.length) {
    replaceItems(kept);
    window.alert('Se quitaron productos que ya no están disponibles.');
  }
}, [menu]); // eslint-disable-line react-hooks/exhaustive-deps
```

> `replaceItems` ya existe en `CartContext`. El `window.alert` es el "aviso único" que pide el spec; si el proyecto tiene un toast, usarlo en su lugar.

- [ ] **Step 6: `CantinaPage` — revalidar al montar si hay ítems en carrito**

Mismo patrón: ya tiene `const { data } = useQuery({ queryKey: ['menu'], ... })` y `replaceItems`. Añadir el `useEffect` que llama `reconcileCart(cart, new Set(data.items.map(i => i.id)))` cuando `data` cambia y `cart.length > 0`, con el mismo `window.alert`. Importar `reconcileCart`.

- [ ] **Step 7: `CantinaPage` / menú — `SafeImage` y `line-clamp`**

- En `MenuCard`, reemplazar `<img src={imgSrc} ...>` por `<SafeImage src={item.imageUrl ?? foodImageFor(item.name, item.category)} alt={item.name} className="h-full w-full" fallbackLabel={item.name} />`.
- Al `<p className="text-sm font-bold text-white">{item.name}</p>` añadir `line-clamp-2`.
- A la descripción (`<p className="mt-0.5 flex-1 text-xs ...">`) añadir `line-clamp-2`.

- [ ] **Step 8: `PaymentPage` — reescribir sin tarjeta**

Reemplazar todo el cuerpo del componente por esta versión (mantiene sesión obligatoria vía `AuthForm`, resumen de ítems, y CTA "Confirmar pedido"):

```tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { publicApi } from '../../../api/public-api';
import { usePublicAuth } from '../auth/PublicAuthContext';
import { useCart, formatPrice } from '../cart/CartContext';
import { AuthForm } from '../auth/AuthForm';
import { SafeImage } from '../SafeImage';

export function PaymentPage() {
  const navigate = useNavigate();
  const { user, token } = usePublicAuth();
  const { items, total, clear, setLastOrder } = useCart();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!items.length) {
    navigate('/carrito', { replace: true });
    return null;
  }

  async function handleConfirm() {
    if (!token) return;
    setProcessing(true);
    setError(null);
    try {
      const order = await publicApi.orders.checkout(
        items.map((i) => ({ salesProductId: i.id, quantity: i.qty })),
        token,
        `checkout-${Date.now()}`,
      );
      setLastOrder(order);
      clear();
      navigate('/qr');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo confirmar el pedido');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="mx-auto space-y-5 p-6" style={{ maxWidth: 720 }}>
      <button
        type="button"
        onClick={() => navigate('/carrito')}
        className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-white"
      >
        ← Volver al carrito
      </button>
      <h1 className="text-2xl font-black text-white">Confirmar pedido</h1>

      {!user ? (
        <div className="rounded-xl border border-[#2a2a2a] bg-lch-card p-5">
          <p className="mb-4 text-sm text-gray-400">
            Iniciá sesión o registrate para confirmar el pedido y obtener tu código QR de retiro.
          </p>
          <AuthForm />
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#1c1c1c]">
            <div className="border-b border-[#2a2a2a] px-5 py-4">
              <h2 className="font-bold text-white">Resumen del pedido</h2>
            </div>
            {items.map((item, i) => (
              <div
                key={item.id}
                className="flex items-center gap-4 p-4"
                style={{ borderBottom: i < items.length - 1 ? '1px solid #2a2a2a' : 'none' }}
              >
                <SafeImage
                  src={item.imageUrl}
                  alt={item.name}
                  className="h-14 w-14 shrink-0 rounded-lg"
                  fallbackLabel={item.emoji ?? '🍽'}
                />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-semibold text-white">{item.name}</p>
                  <span className="mt-1 inline-block rounded bg-[#2a2a2a] px-2 py-0.5 text-[10px] font-semibold text-gray-400">
                    Cant: {item.qty}
                  </span>
                </div>
                <span className="text-sm font-bold text-white">
                  {item.price === 0 ? 'Gratis' : formatPrice(item.price * item.qty)}
                </span>
              </div>
            ))}
            <div className="flex justify-between px-5 py-4">
              <span className="text-base font-black text-lch-accent">Total</span>
              <span className="text-base font-black text-lch-accent">{formatPrice(total)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#2a2a2a] bg-[#1c1c1c] p-5 text-sm text-gray-300">
            <p className="font-bold text-white">Pagás al retirar</p>
            <p className="mt-1 text-gray-400">
              El pago se hace en el mostrador de la cantina cuando retirás el pedido. Te vamos a dar un
              código QR para mostrar al llegar.
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>
          )}

          <button
            type="button"
            disabled={processing}
            onClick={() => void handleConfirm()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-lch-accent py-3.5 text-sm font-black text-[#0e0e0e] disabled:opacity-50"
          >
            {processing ? 'Confirmando...' : 'Confirmar pedido'}
          </button>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 9: `CartPage` — CTA coherente**

Cambiar el texto del botón "Proceder al Pago Seguro" por "Continuar" y el ícono `Lock` es opcional (dejarlo o quitarlo). El destino sigue siendo `/pago`.

- [ ] **Step 10: Verificar tipos + tests**

Run: `npm --prefix apps/web-public run build && npm --prefix apps/web-public test`
Expected: build OK; tests PASAN.

- [ ] **Step 11: Commit**

```bash
git add apps/web-public/src/app/components/public/cart/ apps/web-public/src/app/components/public/pages/CartPage.tsx apps/web-public/src/app/components/public/pages/PaymentPage.tsx apps/web-public/src/app/components/public/pages/CantinaPage.tsx
git commit -m "feat(web-publica): revalidar carrito contra el menu y confirmar pedido sin tarjeta"
```

---

## Task 9: UI — estados del pedido y baja de tarjetas guardadas

**Files:**
- Modify: `apps/web-public/src/app/components/public/pages/OrdersPage.tsx`
- Modify: `apps/web-public/src/app/components/public/pages/QrPage.tsx`
- Modify: `apps/web-public/src/app/components/public/pages/ProfilePage.tsx`

**Interfaces:**
- Consumes: `PublicOrder.status` (`'listo' | 'retirado' | 'cancelado'` + legados).
- Produces: nada.

- [ ] **Step 1: `OrdersPage` — mapa de estados a la vista pública**

Reemplazar `STATUS_LABEL` y `STATUS_COLOR` por:

```tsx
const STATUS_LABEL: Record<string, string> = {
  pendiente_pago: 'Para retirar',
  pagado: 'Para retirar',
  en_cocina: 'Para retirar',
  listo: 'Para retirar',
  retirado: 'Retirado',
  cancelado: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  listo: '#6BFF9E',
  pendiente_pago: '#6BFF9E',
  pagado: '#6BFF9E',
  en_cocina: '#6BFF9E',
  retirado: '#9ca3af',
  cancelado: '#9ca3af',
};
```

El `canShowQr` actual (`order.qr && !order.qr.usado && order.status !== 'retirado'`) ya sirve.

- [ ] **Step 2: `QrPage` — copy de estado**

El texto "Tu código de retiro está listo" ya sirve. Si se muestra el estado en algún lado con el string crudo, mapearlo con el mismo criterio ("Para retirar" / "Retirado"). Verificar que no aparezca "En preparacion".

- [ ] **Step 3: `ProfilePage` — borrar la sección "Medios de Pago"**

- Borrar el `<section>` completo cuyo `<h3>` es "Medios de Pago" (incluye lista de `cards`, el form `addingCard`, y el texto legal del final).
- Borrar el estado y helpers relacionados: `CARDS_KEY`, `interface SavedCard`, `loadCards`, `persistCards`, `cards`, `setCards`, `addingCard`, `setAddingCard`, `newLast4`, `newExpiry`, `newBrand` y sus `setX`.
- Borrar imports que queden sin uso (`Trash2`, etc. — dejar los que se sigan usando).

- [ ] **Step 4: Verificar tipos**

Run: `npm --prefix apps/web-public run build`
Expected: build OK, sin variables/imports sin usar.

- [ ] **Step 5: Verificación en navegador**

Con dev server + API, autenticado, confirmar un pedido (Task 8) y luego:
- `/#/pedidos`: el pedido nuevo dice "Para retirar" (verde) y tiene botón "Ver codigo QR". Ninguno dice "En preparacion".
- `/#/perfil`: no aparece "Medios de Pago" ni "Agregar tarjeta".

Adjuntar screenshot de `/#/pedidos` con un pedido "Para retirar".

- [ ] **Step 6: Commit**

```bash
git add apps/web-public/src/app/components/public/pages/OrdersPage.tsx apps/web-public/src/app/components/public/pages/QrPage.tsx apps/web-public/src/app/components/public/pages/ProfilePage.tsx
git commit -m "feat(web-publica): estados de pedido para-retirar/retirado y baja de tarjetas guardadas"
```

---

## Task 10: Schema — `placement` home/cantina y `durationSeconds`

**Files:**
- Modify: `apps/api/prisma/schema.prisma:83-87` (enum) y `527-546` (model `Patrocinador`)
- Create: `apps/api/prisma/migrations/<timestamp>_sponsors_home_cantina_placement/migration.sql`

**Interfaces:**
- Consumes: nada.
- Produces: enum `PlacementPatrocinador` con `home`, `cantina` añadidos; `Patrocinador.durationSeconds Int @default(5)` (mapeado `duration_seconds`).

- [ ] **Step 1: Editar el enum en `schema.prisma`**

```prisma
enum PlacementPatrocinador {
  banner
  sidebar
  footer
  home
  cantina
}
```

- [ ] **Step 2: Editar el model `Patrocinador`**

Añadir después de `sortOrder`:

```prisma
  durationSeconds Int @default(5) @map("duration_seconds")
```

- [ ] **Step 3: Crear la migración manualmente**

Crear `apps/api/prisma/migrations/<timestamp>_sponsors_home_cantina_placement/migration.sql` (usar timestamp `YYYYMMDDHHMMSS` posterior a `20260908144318`). Contenido:

```sql
-- Nuevos valores de placement (no se borran los viejos)
ALTER TYPE "PlacementPatrocinador" ADD VALUE IF NOT EXISTS 'home';
ALTER TYPE "PlacementPatrocinador" ADD VALUE IF NOT EXISTS 'cantina';

-- Duración por ítem del carrusel
ALTER TABLE "patrocinadores"
  ADD COLUMN "duration_seconds" INTEGER NOT NULL DEFAULT 5;
```

> `ALTER TYPE ... ADD VALUE` no puede correr dentro de la misma transacción que lo usa. Prisma corre cada archivo de migración en su propia transacción; separar el `ADD VALUE` y el `UPDATE` que lo usa en **dos archivos de migración** distintos si Postgres se queja. Estructura recomendada: este archivo sólo hace `ADD VALUE` + `ADD COLUMN`; la migración de datos (Step 4) va en un **segundo** archivo con timestamp posterior.

- [ ] **Step 4: Crear la migración de datos (segundo archivo)**

`apps/api/prisma/migrations/<timestamp+1>_sponsors_migrate_placement_data/migration.sql`:

```sql
-- banner con etiqueta de Cantina -> cantina
UPDATE "patrocinadores"
SET "placement" = 'cantina'
WHERE "placement" = 'banner'
  AND "banner_label" ILIKE '%cantina%';

-- resto de banner (incluye "Home" y banners sin etiqueta) -> home
UPDATE "patrocinadores"
SET "placement" = 'home'
WHERE "placement" = 'banner';

-- sidebar / footer dejan de mostrarse
UPDATE "patrocinadores"
SET "active" = false
WHERE "placement" IN ('sidebar', 'footer');
```

- [ ] **Step 5: Aplicar y regenerar el cliente**

Run: `npm --prefix apps/api run prisma:migrate` (o `npx --prefix apps/api prisma migrate dev` sin `--name`, ya que las migraciones existen).
Luego: `npm --prefix apps/api run prisma:generate`
Expected: migraciones aplicadas, cliente Prisma con `durationSeconds` y los enums nuevos.

- [ ] **Step 6: Verificar que no hay drift**

Run: `npm --prefix apps/api run db:drift`
Expected: sin drift.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/
git commit -m "feat(api): placement home/cantina y durationSeconds para patrocinadores"
```

---

## Task 11: API — sponsors: DTO, validación y `GET /public/sponsors`

**Files:**
- Create: `apps/api/src/sponsors/dto/sponsor.dto.ts`
- Modify: `apps/api/src/sponsors/sponsors.controller.ts`
- Modify: `apps/api/src/sponsors/sponsors.service.ts`
- Modify: `apps/api/src/public/public.service.ts:407-423` (`listSponsors`)
- Test: `apps/api/test/db/public-sponsors.test.ts`

**Interfaces:**
- Consumes: cliente Prisma con `durationSeconds` (Task 10).
- Produces:
  - `CreateSponsorDto` / `UpdateSponsorDto` con `durationSeconds?: number` validado `@IsInt() @Min(2) @Max(60)`.
  - `SponsorsService.create/update` aceptan y persisten `durationSeconds` (default 5 si `undefined`).
  - `PublicService.listSponsors()` devuelve sólo `active: true` **y** `placement in ('home','cantina')`, incluyendo `durationSeconds`, ordenado por `sortOrder asc, createdAt asc`.

- [ ] **Step 1: Escribir el test que falla**

`apps/api/test/db/public-sponsors.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { PublicService } from '../../src/public/public.service';
import { SponsorsService } from '../../src/sponsors/sponsors.service';
import { CreateSponsorDto } from '../../src/sponsors/dto/sponsor.dto';
import { validateOrReject } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';
import type { ReglamentoEngineService } from '../../src/reglamento/reglamento-engine.service';

const prisma = testPrisma();
const publicService = new PublicService(
  prisma as unknown as PrismaService,
  {} as unknown as ReglamentoEngineService,
);
const sponsors = new SponsorsService(prisma as unknown as PrismaService);

describe('sponsors públicos (Postgres real)', () => {
  beforeEach(async () => { await resetTestDb(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('listSponsors no devuelve sidebar, footer ni inactivos', async () => {
    await prisma.patrocinador.create({ data: { name: 'Home A', imageUrl: '/a', placement: 'home' } });
    await prisma.patrocinador.create({ data: { name: 'Cantina A', imageUrl: '/b', placement: 'cantina' } });
    await prisma.patrocinador.create({ data: { name: 'Side', imageUrl: '/c', placement: 'sidebar' } });
    await prisma.patrocinador.create({ data: { name: 'Foot', imageUrl: '/d', placement: 'footer' } });
    await prisma.patrocinador.create({ data: { name: 'Home Off', imageUrl: '/e', placement: 'home', active: false } });

    const rows = await publicService.listSponsors();
    expect(rows.map((r) => r.name).sort()).toEqual(['Cantina A', 'Home A']);
    expect(rows[0]).toHaveProperty('durationSeconds');
  });

  it('crear un sponsor con durationSeconds fuera de 2–60 falla la validación del DTO', async () => {
    const dto = plainToInstance(CreateSponsorDto, {
      name: 'X', imageUrl: '/x', placement: 'home', durationSeconds: 61,
    });
    await expect(validateOrReject(dto)).rejects.toBeDefined();
  });

  it('el service default-ea durationSeconds a 5', async () => {
    const created = await sponsors.create({ name: 'Y', imageUrl: '/y', placement: 'home' });
    expect(created.durationSeconds).toBe(5);
  });
});
```

- [ ] **Step 2: Correr — debe fallar**

Run: `npm --prefix apps/api run test:db -- public-sponsors`
Expected: FALLA (DTO no existe; `listSponsors` hoy devuelve sidebar/footer y no filtra placement).

- [ ] **Step 3: Escribir `dto/sponsor.dto.ts`**

```ts
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const PLACEMENTS = ['home', 'cantina', 'banner', 'sidebar', 'footer'] as const;
const MEDIA = ['image', 'video'] as const;

export class CreateSponsorDto {
  @IsString() name!: string;
  @IsString() imageUrl!: string;
  @IsOptional() @IsIn(PLACEMENTS) placement?: string;
  @IsOptional() @IsString() linkUrl?: string;
  @IsOptional() @IsString() bannerLabel?: string;
  @IsOptional() @IsIn(MEDIA) mediaType?: string;
  @IsOptional() @IsInt() widthPx?: number;
  @IsOptional() @IsInt() heightPx?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsInt() @Min(2) @Max(60) durationSeconds?: number;
}

export class UpdateSponsorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsIn(PLACEMENTS) placement?: string;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() linkUrl?: string;
  @IsOptional() @IsString() bannerLabel?: string;
  @IsOptional() @IsIn(MEDIA) mediaType?: string;
  @IsOptional() @IsInt() widthPx?: number;
  @IsOptional() @IsInt() heightPx?: number;
  @IsOptional() @IsInt() sortOrder?: number;
  @IsOptional() @IsInt() @Min(2) @Max(60) durationSeconds?: number;
}
```

- [ ] **Step 4: Usar los DTOs en `sponsors.controller.ts`**

Reemplazar los `@Body() body: { ... }` inline de `create` y `update` por `@Body() body: CreateSponsorDto` / `@Body() body: UpdateSponsorDto`. Importar desde `./dto/sponsor.dto`.

- [ ] **Step 5: Persistir `durationSeconds` en `sponsors.service.ts`**

- En `create(data)`: añadir a `data` del `create` de Prisma: `durationSeconds: data.durationSeconds ?? 5,`. Añadir `durationSeconds?: number;` a la firma del parámetro.
- En `update(id, data)`: añadir `durationSeconds?: number;` a la firma; el spread `...data` ya lo pasa, pero explicitar para claridad no molesta.

- [ ] **Step 6: `listSponsors()` en `public.service.ts`**

```ts
async listSponsors() {
  return this.prisma.patrocinador.findMany({
    where: { active: true, placement: { in: ['home', 'cantina'] } },
    orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      imageUrl: true,
      placement: true,
      bannerLabel: true,
      mediaType: true,
      widthPx: true,
      heightPx: true,
      linkUrl: true,
      durationSeconds: true,
    },
  });
}
```

- [ ] **Step 7: Correr — debe pasar**

Run: `npm --prefix apps/api run test:db -- public-sponsors`
Expected: PASA (3/3).

- [ ] **Step 8: Suites completas API**

Run: `npm --prefix apps/api test && npm --prefix apps/api run test:db`
Expected: PASA. (Ajustar `test/db/online-constraints.test.ts` si el test "acepta placement válido" necesita cubrir `home`/`cantina`; añadir esos dos valores al array del test si corresponde.)

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/sponsors/ apps/api/src/public/public.service.ts apps/api/test/db/public-sponsors.test.ts
git commit -m "feat(api): sponsors con durationSeconds validado y endpoint publico filtrado por slot"
```

---

## Task 12: Admin — dos slots y campo de duración

**Files:**
- Modify: `apps/web-admin/src/features/online/sponsor-placements.ts`
- Modify: `apps/web-admin/src/features/online/panels/SponsorsPanel.tsx`
- Modify: `apps/web-admin/src/app/api/client.ts` (tipos `Sponsor`, `CreateSponsorPayload`, `UpdateSponsorPayload`)

**Interfaces:**
- Consumes: `sponsorsApi.create/update` (ahora aceptan `durationSeconds`).
- Produces: `SPONSOR_PLACEMENTS` con exactamente dos entradas (`home`, `cantina`), `placement` = valor real del enum.

- [ ] **Step 1: Reescribir `sponsor-placements.ts`**

```ts
export type SponsorPlacementOption = {
  id: string;
  label: string;
  placement: string;
  bannerLabel: string;
  widthPx: number;
  heightPx: number;
  hint: string;
};

export const SPONSOR_PLACEMENTS: SponsorPlacementOption[] = [
  {
    id: 'home',
    label: 'Inicio — Banner principal',
    placement: 'home',
    bannerLabel: 'Inicio — Banner principal',
    widthPx: 920,
    heightPx: 86,
    hint: 'Imagen o video horizontal, ancho completo del contenido.',
  },
  {
    id: 'cantina',
    label: 'Cantina — Banner promo',
    placement: 'cantina',
    bannerLabel: 'Cantina — Banner promo',
    widthPx: 768,
    heightPx: 112,
    hint: 'Banner promocional en la página de cantina.',
  },
];

export function placementOptionById(id: string) {
  return SPONSOR_PLACEMENTS.find((p) => p.id === id) ?? SPONSOR_PLACEMENTS[0];
}
```

- [ ] **Step 2: Tipos en `client.ts`**

- `interface Sponsor`: añadir `durationSeconds?: number;`.
- `interface CreateSponsorPayload`: añadir `durationSeconds?: number;`.
- `interface UpdateSponsorPayload`: añadir `durationSeconds?: number;`.

- [ ] **Step 3: `SponsorsPanel.tsx` — campo de duración**

- Estado: `const [durationSeconds, setDurationSeconds] = useState(5);` y `const [editDuration, setEditDuration] = useState(5);`.
- En el form de alta, junto al select de "Tipo de media", añadir:

```tsx
<div>
  <label className="mb-1 block text-xs font-medium text-muted-foreground">
    Segundos por banner (2–60)
  </label>
  <input
    type="number"
    min={2}
    max={60}
    className={onlineFieldClass()}
    value={durationSeconds}
    onChange={(e) => setDurationSeconds(Number(e.target.value))}
  />
</div>
```

- En `handleCreate`, pasar `durationSeconds` en el objeto a `sponsorsApi.create`. Quitar `bannerLabel: selectedPlacement.bannerLabel` no es necesario — se puede seguir mandando como texto del slot (el sitio público ya no lo usa para rutear).
- En `startEdit`, hacer `setEditDuration(row.durationSeconds ?? 5)` y elegir `editPlacementId` por `SPONSOR_PLACEMENTS.find((p) => p.placement === row.placement) ?? SPONSOR_PLACEMENTS[0]` (ya no por `bannerLabel`).
- En `saveEdit`, pasar `durationSeconds: editDuration`.
- En el form de edición, añadir el mismo `<input type="number">` para `editDuration`.
- En la card de cada sponsor, añadir una línea: `<p className="text-xs text-muted-foreground">{row.durationSeconds ?? 5}s por rotación</p>`.

- [ ] **Step 4: Verificar tipos + tests admin**

Run: `npm --prefix apps/web-admin run build && npm --prefix apps/web-admin test`
Expected: build OK; tests PASAN.

- [ ] **Step 5: Commit**

```bash
git add apps/web-admin/src/features/online/ apps/web-admin/src/app/api/client.ts
git commit -m "feat(admin): sponsors con dos slots reales (inicio/cantina) y segundos por banner"
```

---

## Task 13: `SponsorCarousel` y limpieza de banners duplicados

**Files:**
- Create: `apps/web-public/src/app/components/public/sponsors/sponsor-carousel-model.ts`
- Create: `apps/web-public/src/app/components/public/sponsors/sponsor-carousel-model.test.ts`
- Create: `apps/web-public/src/app/components/public/sponsors/SponsorCarousel.tsx`
- Modify: `apps/web-public/src/app/api/public-api.ts` (`PublicSponsor.durationSeconds`)
- Modify: `apps/web-public/src/app/components/public/pages/HomePage.tsx` (usar `SponsorCarousel`, borrar `SponsorBanner`)
- Modify: `apps/web-public/src/app/components/public/pages/CantinaPage.tsx` (usar `SponsorCarousel`, borrar `CantinaPromoBanner` y `cantinaBanner`)
- Modify: `apps/web-public/src/app/components/public/PublicLayout.tsx` (borrar `FooterSponsors`/`MobileFooterSponsors`/`SidebarSponsors` y `usePublicSponsors`)
- Delete: `apps/web-public/src/app/components/public/SponsorPlacements.tsx` y `apps/web-public/src/app/components/public/SponsorPlacement.tsx` si quedan sin referencias.

**Interfaces:**
- Consumes: `publicApi.sponsors()` → `PublicSponsor[]` con `durationSeconds`.
- Produces:
  - `orderSponsorsForSlot(sponsors: PublicSponsor[], slot: 'home' | 'cantina'): PublicSponsor[]` — filtra por `placement === slot`, ya vienen ordenados del server pero se re-ordena defensivamente por índice (estable).
  - `carouselDwellMs(sponsor: PublicSponsor): number` — `clamp(durationSeconds ?? 5, 2, 60) * 1000`.
  - `nextIndex(current: number, length: number): number` — `(current + 1) % length`.
  - `SponsorCarousel({ slot, sponsors }: { slot: 'home' | 'cantina'; sponsors: PublicSponsor[] }): JSX.Element | null`.

- [ ] **Step 1: `PublicSponsor.durationSeconds` en `public-api.ts`**

En `interface PublicSponsor` añadir `durationSeconds?: number;`.

- [ ] **Step 2: Escribir el test del modelo**

`sponsor-carousel-model.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { orderSponsorsForSlot, carouselDwellMs, nextIndex } from './sponsor-carousel-model';
import type { PublicSponsor } from '../../../api/public-api';

const s = (over: Partial<PublicSponsor>): PublicSponsor =>
  ({ id: 'x', name: 'X', imageUrl: '/x', placement: 'home', ...over } as PublicSponsor);

describe('sponsor-carousel-model', () => {
  it('orderSponsorsForSlot filtra por slot y preserva el orden recibido', () => {
    const list = [
      s({ id: 'a', placement: 'home' }),
      s({ id: 'b', placement: 'cantina' }),
      s({ id: 'c', placement: 'home' }),
    ];
    expect(orderSponsorsForSlot(list, 'home').map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('carouselDwellMs usa durationSeconds del ítem, con clamp 2–60 y default 5', () => {
    expect(carouselDwellMs(s({ durationSeconds: 8 }))).toBe(8000);
    expect(carouselDwellMs(s({ durationSeconds: undefined }))).toBe(5000);
    expect(carouselDwellMs(s({ durationSeconds: 1 }))).toBe(2000);
    expect(carouselDwellMs(s({ durationSeconds: 120 }))).toBe(60000);
  });

  it('nextIndex rota y vuelve a 0', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
});
```

- [ ] **Step 3: Correr — debe fallar**

Run: `npm --prefix apps/web-public test -- sponsor-carousel-model`
Expected: FALLA (módulo no existe).

- [ ] **Step 4: Escribir `sponsor-carousel-model.ts`**

```ts
import type { PublicSponsor } from '../../../api/public-api';

export function orderSponsorsForSlot(
  sponsors: PublicSponsor[],
  slot: 'home' | 'cantina',
): PublicSponsor[] {
  return sponsors.filter((s) => s.placement === slot);
}

export function carouselDwellMs(sponsor: PublicSponsor): number {
  const raw = sponsor.durationSeconds ?? 5;
  const clamped = Math.min(60, Math.max(2, Math.round(raw)));
  return clamped * 1000;
}

export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}
```

- [ ] **Step 5: Correr — debe pasar**

Run: `npm --prefix apps/web-public test -- sponsor-carousel-model`
Expected: PASA (3/3).

- [ ] **Step 6: Escribir `SponsorCarousel.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import type { PublicSponsor } from '../../../api/public-api';
import { carouselDwellMs, nextIndex, orderSponsorsForSlot } from './sponsor-carousel-model';

const MOVE_MS = 400;

function prefersReducedMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function Slide({ sponsor }: { sponsor: PublicSponsor }) {
  const height = sponsor.heightPx ?? 96;
  const body = sponsor.imageUrl ? (
    sponsor.mediaType === 'video' ? (
      <video
        src={sponsor.imageUrl}
        muted
        playsInline
        autoPlay
        loop={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    ) : (
      <img
        src={sponsor.imageUrl}
        alt={sponsor.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    )
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-[#161616] text-[11px] font-bold text-gray-500">
      {sponsor.name}
    </div>
  );

  const shell = (
    <div
      className="relative overflow-hidden rounded-xl border border-[#2a2a2a]"
      style={{ height, background: '#161616' }}
    >
      {body}
    </div>
  );

  if (sponsor.linkUrl) {
    return (
      <a href={sponsor.linkUrl} target="_blank" rel="noopener noreferrer" className="block">
        {shell}
      </a>
    );
  }
  return shell;
}

export function SponsorCarousel({
  slot,
  sponsors,
}: {
  slot: 'home' | 'cantina';
  sponsors: PublicSponsor[];
}) {
  const slides = useMemo(() => orderSponsorsForSlot(sponsors, slot), [sponsors, slot]);
  const [index, setIndex] = useState(0);
  const reduced = prefersReducedMotion();
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  useEffect(() => {
    setIndex(0);
  }, [slot, slides.length]);

  useEffect(() => {
    if (reduced || slides.length < 2) return;
    const dwell = carouselDwellMs(slides[index]);
    const t = setTimeout(() => setIndex((i) => nextIndex(i, slides.length)), dwell + MOVE_MS);
    return () => clearTimeout(t);
  }, [index, slides, reduced]);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === index) {
        void v.play().catch(() => {});
      } else {
        v.pause();
        v.currentTime = 0;
      }
    });
  }, [index]);

  if (slides.length === 0) return null;
  if (slides.length === 1 || reduced) return <Slide sponsor={slides[0]} />;

  return (
    <div className="overflow-hidden">
      <div
        className="flex"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: `transform ${MOVE_MS}ms ease`,
        }}
      >
        {slides.map((s, i) => (
          <div key={s.id} className="w-full shrink-0" style={{ flex: '0 0 100%' }}>
            <Slide
              sponsor={s}
              // ref del video se cablea abajo
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

> Nota para el ejecutor: si querés el control fino de `pause()/currentTime` por slide, pasá una `ref` callback al `<video>` de `Slide` (prop opcional `videoRef`). El modelo de estado (índice, dwell, orden) ya está cubierto por tests; el `<video>` fino es verificación en navegador (Task 14).

- [ ] **Step 7: Usar `SponsorCarousel` en `HomePage`**

- Importar `SponsorCarousel` y `usePublicSponsors` (o un `useQuery` local a `publicApi.sponsors()`).
- Reemplazar el bloque `{!!data?.sponsors.length && (<SponsorBanner sponsor={...} />)}` por:

```tsx
<SponsorCarousel slot="home" sponsors={data?.sponsors ?? []} />
```

- Borrar la función `SponsorBanner` completa del archivo.

- [ ] **Step 8: Usar `SponsorCarousel` en `CantinaPage`**

- Importar `SponsorCarousel`.
- Borrar `cantinaBanner` (el `useMemo` con `bannerLabel?.includes('Cantina')`) y la función `CantinaPromoBanner`.
- Reemplazar `<CantinaPromoBanner banner={cantinaBanner} />` por `<SponsorCarousel slot="cantina" sponsors={sponsors} />` (la query `['sponsors-cantina']` ya trae `sponsors`).

- [ ] **Step 9: Limpiar `PublicLayout.tsx`**

- Borrar el import de `FooterSponsors, MobileFooterSponsors, SidebarSponsors, usePublicSponsors`.
- Borrar `const { data: sponsors = [] } = usePublicSponsors();`.
- Borrar `<SidebarSponsors sponsors={sponsors} />` del `Sidebar` y el prop `sponsors` de la firma de `Sidebar` + su uso.
- Borrar `<FooterSponsors sponsors={sponsors} />` y `{!hideMobileNav && <MobileFooterSponsors sponsors={sponsors} />}`.

- [ ] **Step 10: Borrar componentes muertos**

Run: `grep -rn "SponsorPlacements\|SponsorPlacement\|SidebarSponsors\|FooterSponsors" apps/web-public/src`
Si no quedan referencias (salvo el archivo propio), borrar `SponsorPlacements.tsx` y `SponsorPlacement.tsx`. Si `usePublicSponsors` se usa en otro lado, mantener sólo esa función moviéndola a `SponsorCarousel.tsx` o a un `use-public-sponsors.ts`.

- [ ] **Step 11: Verificar build + tests**

Run: `npm --prefix apps/web-public run build && npm --prefix apps/web-public test`
Expected: build OK (sin imports rotos); tests PASAN.

- [ ] **Step 12: Commit**

```bash
git add apps/web-public/src/app/components/public/sponsors/ apps/web-public/src/app/api/public-api.ts apps/web-public/src/app/components/public/pages/HomePage.tsx apps/web-public/src/app/components/public/pages/CantinaPage.tsx apps/web-public/src/app/components/public/PublicLayout.tsx apps/web-public/src/app/components/public/SponsorPlacement*.tsx
git commit -m "feat(web-publica): SponsorCarousel RTL por slot y baja de banners/sidebar/footer duplicados"
```

---

## Task 14: Verificación end-to-end en navegador

**Files:** ninguno (verificación). Si algo falla, volver a la tarea correspondiente, arreglar, y re-verificar.

**Interfaces:** consume todo lo anterior.

- [ ] **Step 1: Levantar API + web-public + seed de demo**

```bash
npm --prefix apps/api run prisma:seed:demo
npm --prefix apps/api run dev
```
```bash
npm --prefix apps/web-public run dev
```

Cargar en el admin al menos: 2 sponsors `home` (uno imagen, uno video) con distinta `durationSeconds`, y 1 sponsor `cantina`.

- [ ] **Step 2: Cantina — desktop**

Browser pane en `/#/cantina`:
- Un producto cuyo insumo tenga stock 0 en la base **no aparece** en el menú.
- Poner ese insumo en 0 con un ítem ya en el carrito → ir a `/#/carrito` → aparece el alert "Se quitaron productos que ya no están disponibles." y la línea desaparece.

- [ ] **Step 3: Cantina — móvil (375×812)**

`resize_window` preset `mobile`, recargar:
- Header no tapado por el notch; nav inferior con separación; FAB "N items" por encima del nav y clickeable.
- Doble header (layout + sticky de cantina): confirmar que el menú sigue **usable**. Si queda inutilizable, ocultar el header del layout sólo en `/cantina` (en `PublicLayout`, condicionar el `<header className="... md:hidden">` a `path !== '/cantina'`), commitear como fix aparte.

- [ ] **Step 4: Confirmar pedido → QR → retiro**

- `/#/carrito` → "Continuar" → `/#/pago`: **no** hay campos de tarjeta; dice "Pagás al retirar"; CTA "Confirmar pedido".
- Confirmar → navega a `/#/qr` con QR visible.
- `/#/pedidos`: el pedido dice "Para retirar" y ofrece "Ver codigo QR".
- En el admin (Online → Cocina) el pedido aparece en el KDS.
- Escanear/redimir el QR (endpoint `POST /online/redeem-qr`) → `/#/pedidos` pasa a "Retirado".

- [ ] **Step 5: Sponsors**

- `/#/` (home): el/los sponsor(s) `home` rotan RTL; el tiempo de permanencia respeta la `durationSeconds` de cada uno; el video se reproduce sólo en su slide y se reinicia al salir.
- `/#/cantina`: el banner promo es el sponsor `cantina`.
- Con 0 sponsors en un slot: no hay hueco. Con 1: estático.
- No hay franja de sponsors en sidebar (desktop) ni footer.
- DevTools → emular `prefers-reduced-motion: reduce` → no anima, muestra el primero.

- [ ] **Step 6: Errores y media**

- Parar la API → `/#/pedidos`, `/#/qr`, `/#/` muestran el bloque de error con "Reintentar", no listas vacías.
- `/#/fotos`: lightbox de un video reproduce `<video controls>`.
- `/#/perfil`: sin sección "Medios de Pago".

- [ ] **Step 7: Suite completa final**

Run:
```bash
npm --prefix apps/api test && npm --prefix apps/api run test:db && npm --prefix apps/web-public test && npm --prefix apps/web-admin test
```
Expected: todo PASA.

- [ ] **Step 8: Commit final (si hubo fixes de verificación)**

```bash
git add -A
git commit -m "fix(web-publica): ajustes de la verificacion en navegador de cantina y sponsors"
```

---

## Self-Review

**1. Cobertura del spec:**

| Requisito del spec | Tarea |
|---|---|
| Menú omite agotados (server) | Task 6 |
| Carrito revalida y avisa | Task 8 |
| Checkout exige `visibleWeb` → 400 | Task 7 |
| 409 de stock en español con nombres | Task 7 |
| Pedido nace `listo` + `OrdenCocina` | Task 7 |
| `/pago` sin tarjeta, "pagás al retirar" | Task 8 |
| Borrar `serviceFee` de Cart/Payment | Task 8 |
| Borrar tarjetas guardadas de Profile | Task 9 |
| Estados `/pedidos` y `/qr` (Para retirar / Retirado) | Task 9 |
| Enum `home`/`cantina` + `durationSeconds` + migración de datos | Task 10 |
| Validación `durationSeconds` 2–60, default 5 | Task 11 |
| `GET /public/sponsors` filtra slot, ordena `sortOrder`/`createdAt` | Task 11 |
| Admin: dos slots, campo segundos | Task 12 |
| `SponsorCarousel` (0/1/N, video, reduced-motion, link) | Task 13 |
| Borrar `SponsorBanner`/`CantinaPromoBanner`/sidebar/footer | Task 13 |
| Safe-area header/nav/modal/lightbox | Task 3 |
| FAB del carrito sobre el nav | Task 3 |
| Lightbox video + galería home video | Task 4 |
| `isError` en OrdersPage/QrPage/HomePage | Task 5 |
| `SafeImage` en menú/carrito/galería | Tasks 2, 4, 8 |
| `line-clamp` en nombres largos | Task 8 |
| Verificación en navegador (desktop + móvil) | Task 14 |
| Tests backend (7) y frontend (2) del spec §4 | Tasks 6, 7, 11, 8, 13 |

Ítems de "Consistencia" de menor prioridad del spec §3 (área táctil 44px de +/-, `focus-visible:ring` global, `text-gray-600`→`text-gray-400`): quedan como pulido opcional dentro de Task 3/8 si el tiempo lo permite; no bloquean los criterios de éxito. Anotarlos si se difieren.

**2. Placeholders:** revisado — cada step de código tiene el bloque real. Las dos "Notas para el ejecutor" (nombres de modelos Prisma de receta/promo; ref de video del carrusel) son verificaciones puntuales, no trabajo sin especificar.

**3. Consistencia de tipos:** `reconcileCart(lines, Set<string>) → { kept, removedNames }` usado igual en Task 8 (Cart y Cantina). `menuItemHasStock(id, spMap, Map<string,number>)` consistente entre `menu-availability.ts` y su test. `carouselDwellMs`/`nextIndex`/`orderSponsorsForSlot` consistentes entre modelo, test y componente. `durationSeconds` con default 5 en schema, DTO, service y modelo del carrusel.

---

## Execution Handoff

Plan completo y guardado en `docs/superpowers/plans/2026-09-09-web-publica-cantina-sponsors.md`.

Nota de alcance: el spec trata esto como un solo entregable ("Proyecto A") con orden de implementación interdependiente, así que va como un plan único de 14 tareas en 4 fases (shell/errores → cantina → sponsors → verificación). Si preferís partirlo, el corte natural es Fase 2 (cantina, Tasks 6–9) y Fase 3 (sponsors, Tasks 10–13) como planes separados, con la Fase 1 (Tasks 1–5) como prerequisito compartido.

Dos opciones de ejecución:

**1. Subagent-Driven (recomendado)** — despacho un subagente fresco por tarea, reviso entre tareas, iteración rápida.

**2. Inline Execution** — ejecuto las tareas en esta sesión con checkpoints de review por lote.

¿Cuál preferís?
