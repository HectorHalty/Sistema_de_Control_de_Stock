# Web pública: cantina, sponsors y bugs visuales — Diseño

**Fecha:** 2026-09-09
**Proyecto:** A (web clientes funcional, sin pagos ni identidad deportiva)
**Estado:** aprobado para planificación

## Problema

El sitio público (`apps/web-public`) ya tiene rutas, API y pantallas para cantina y
sponsors, pero el flujo no es usable de punta a punta:

- El menú no respeta stock. El cliente puede armar un carrito de productos agotados y
  solo se entera en el checkout, con un 409 en inglés.
- `/pago` simula una tarjeta, tiene un botón de billetera sin handler, y confirma el
  pedido igual. El usuario pidió cobro **al retirar**, no simulación.
- El pedido público nace en `en_cocina` y cocina nunca actualiza `PedidoPublico.status`,
  así que el cliente no tiene un estado honesto. El producto acordado es: si hay stock,
  se vende (misma lógica que mostrador) y queda **listo para retirar**.
- Los sponsors del admin tienen cuatro “ubicaciones” fake vía `bannerLabel`. El sitio
  público elige **un** banner con `includes('Home')` / `includes('Cantina')`, no rota, y
  además renderiza sidebar y footer que **no deben existir**.
- Hay bugs de layout en móvil (safe-area nunca aplicada, FAB del carrito tapado por el
  nav, lightbox de fotos que pone `<img>` en videos) y queries sin estado de error.

## Fuera de alcance (explícito)

Este spec **no** cubre:

- Integración de pagos (Mercado Pago, billetera, captura de tarjeta).
- Módulo de torneo, reglamento, administrar equipo, ni datos de fixture.
- Proyecto B de identidad: login Google, DNI obligatorio, vistas personalizadas de
  jugador/capitán, estadísticas. Eso va a su propio spec.
- Borrar código legado no montado (`store.ts`, `client.ts`, `adapters.ts`,
  `PublicAppContext.tsx`).
- Canal en vivo / polling / push para el pedido. No hace falta: el pedido nace listo.

## Decisiones tomadas

| Tema | Decisión |
|---|---|
| Qué es “ecommerce” | Solo el flujo de cantina ya existente: menú → carrito → confirmar → QR. No hay tienda de merch. |
| Productos agotados | **No se muestran** en el menú. Se filtran en el servidor. |
| Stock | Misma receta y almacenes que el mostrador. Reusar helpers de `sales-stock.ts`. |
| Pago | Confirmar pedido y pagar al retirar en mostrador. Sin formulario de tarjeta. |
| Estados públicos del pedido | Solo **para retirar** y **retirado**. |
| Cocina | El pedido online **sigue** generando `OrdenCocina` para el KDS del admin. |
| Sponsors | Dos slots fijos: Inicio y Cantina. Imagen o video. Carrusel RTL. Segundos por ítem, puestos por el admin. |
| Sidebar / footer de sponsors | **No existen.** Se sacan del admin y del sitio público. |
| Identidad / Google / stats | Proyecto B, no este. Login actual (email + contraseña) se deja para poder pedir. |

## Enfoques considerados

### Cantina / disponibilidad

1. **Calcular disponibilidad en `listMenu()` reusando `loadSalesProductsForStock` + `buildRequiredByStockProduct`.** El menú y el checkout no pueden divergir en promos. **Elegido.**
2. Flag `disponible` mantenido a mano en el CMS. Se pudre: el mostrador descuenta y la web no se entera.
3. Dejar el menú como está y solo mejorar el mensaje del 409. El cliente sigue armando un carrito inútil.

### Sponsors

1. **Dos valores de `placement` de primera clase (`home` / `cantina`) + `durationSeconds` + un `SponsorCarousel`.** **Elegido.** El admin ya piensa en slots fijos (`sponsor-placements.ts`); el sitio público no los honra.
2. Seguir usando `bannerLabel.includes('Home')`. Es exactamente el bug.
3. Un sponsor con muchas URLs. Complica el upload que ya existe (una media por fila) y no hace falta: N filas en el mismo slot **son** el carrusel.

### Pago interino

1. **Pantalla de confirmación “pagás al retirar”.** **Elegido.**
2. Dejar la simulación de tarjeta y deshabilitar la billetera. Sigue mintiendo.
3. Dejar el esqueleto de Mercado Pago “para después”. Fuera de alcance; no se construye deuda a propósito.

## Arquitectura

```text
Cliente (web-public)
  GET  /public/menu              → ítems con stock suficiente para 1 unidad
  GET  /public/sponsors          → activos en slot home | cantina + durationSeconds
  POST /public/orders/checkout   → visibleWeb + stock (SalesService) → PedidoPublico listo + QR + OrdenCocina
  GET  /public/orders            → para retirar | retirado
  POST /online/redeem-qr         → (admin) PedidoPublico.retirado   [ya existe]
```

Unidades:

| Unidad | Hace | Se usa | Depende de |
|---|---|---|---|
| `PublicService.listMenu` | Omite ítems sin stock para 1 unidad | CantinaPage, CartPage (revalidar) | `sales-stock.ts`, `NivelStock` |
| `PublicOrdersService.checkout` | Exige `visibleWeb`, traduce 409, crea pedido `listo` | PaymentPage | `SalesService.checkout` |
| `SponsorCarousel` | Rota media de un slot RTL | HomePage, CantinaPage | `GET /public/sponsors` |
| `SponsorsPanel` | Alta/edición: slot, media, segundos | Admin online | `POST/PUT /sponsors` |
| Shell visual | Safe-area, nav, errores, imágenes | Todas las rutas públicas | Tailwind `safe-top` / `safe-bottom` |

## 1. Cantina

### Disponibilidad

En `apps/api/src/public/public.service.ts` `listMenu()`:

1. Trae `ProductoVenta` con `active: true` y `visibleWeb: true` (igual que hoy).
2. Carga recetas con `loadSalesProductsForStock`.
3. Para cada ítem, `buildRequiredByStockProduct([{ salesProductId, quantity: 1 }], map)`.
4. Suma `NivelStock.quantity` por `productId` (todos los depósitos, igual que el checkout greedy).
5. Si falta receta resoluble (simple sin receta, promo sin componentes) **o** algún insumo tiene requerido > disponible → **se omite el ítem**. No se envía `disponible: false`; no está en la lista.
6. Categorías y filtros se siguen devolviendo completos. Una categoría sin ítems visibles queda vacía en el cliente; CantinaPage ya tiene “Sin resultados”.

No se expone `maxUnidades` en esta entrega. El tope real sigue siendo el checkout (misma carrera que el mostrador: dos clientes pueden pedir la última unidad; uno gana, el otro ve error claro).

### Carrito

`CartContext` sigue en `localStorage` (`lch_public_cart`). Sin carrito server.

Al abrir `/carrito` (y al montar CantinaPage si hay ítems en carrito): refetch de `/public/menu` y **se eliminan** las líneas cuyo `id` ya no está en el menú. Aviso único: “Se quitaron productos que ya no están disponibles.”

No se puede agregar un id que no vino en el menú.

### Checkout

En `apps/api/src/public/public-orders.service.ts`, **antes** de `sales.checkout`:

- Verificar que todos los `salesProductId` existan con `active: true` **y** `visibleWeb: true`. Si no: 400 con los nombres. El POS no cambia: `SalesService` sigue filtrando solo `active`.

Si `sales.checkout` lanza `ConflictException` de stock:

- De los ítems **de este pedido**, incluir el nombre de cada línea cuya receta usa algún `stockProductId` de `missing`.
- Responder 409 `{ message: 'No hay stock suficiente para: …' }` en español. Sin ids de insumos ni payload interno.

Creación del `PedidoPublico`:

- `status: 'listo'` (no `en_cocina`).
- `TokenRetiroQR` igual que hoy.
- `OrdenCocina` se sigue creando y linkeando (`pedidoPublicoId`). El KDS no se toca.

`POST /online/redeem-qr` ya pasa a `retirado`. No hay transición pública a `listo` porque nace listo.

### Pantalla `/pago`

Reemplazar el formulario de tarjeta y el botón muerto “Pagar con Billetera Digital” por:

- Resumen de ítems y total (sin `serviceFee`; hoy está hardcodeado `0` en `PaymentPage` y `CartPage` — se borra).
- Texto: se paga al retirar en el mostrador.
- CTA: “Confirmar pedido”. Sigue exigiendo sesión (`AuthForm` si es invitado).
- Mismo `publicApi.orders.checkout` de hoy.

En `ProfilePage`, borrar la sección de tarjetas guardadas en `lch_public_saved_cards`. No está conectada a nada y contradice “pagás al retirar”.

### `/pedidos` y `/qr`

Estados visibles:

| `PedidoPublico.status` | UI |
|---|---|
| `listo` (y legado `en_cocina`, `pagado`, `pendiente_pago`) | **Para retirar** + enlace al QR |
| `retirado` | Retirado |
| `cancelado` | Cancelado (si aparece; este spec no agrega cancelación pública) |

Sin polling. El QR se muestra como hoy.

Errores de query: no más empty-state mentiroso. Ver sección visual.

## 2. Sponsors

### Modelo

`Patrocinador` (`apps/api/prisma/schema.prisma`):

- Agregar al enum `PlacementPatrocinador` los valores `home` y `cantina`. **No borrar** `banner`, `sidebar`, `footer` en esta entrega (sacar valores de un enum de Postgres es otro trabajo). Quedan muertos.
- Agregar `durationSeconds Int @default(5)`.
- Validación API: entero 2–60 inclusive. Default 5 si viene vacío.

Migración de datos:

- `placement = banner` y `bannerLabel` contiene `"Cantina"` (case insensitive) → `cantina`.
- Resto de `banner` (incluye `"Home"` y banners sin etiqueta) → `home`.
- `sidebar` y `footer` → `active = false` (no se muestran; no se reescriben a home/cantina).

`GET /public/sponsors` (y el bloque de sponsors de `home-bundle`):

- `where: { active: true, placement: { in: ['home', 'cantina'] } }`.
- Incluir `durationSeconds`.
- Orden dentro del slot: `sortOrder` asc, luego `createdAt` asc (el que se cargó primero sale primero). Esta entrega **no** agrega UI de reordenar: todos nacen con `sortOrder = 0`.

### Admin

`apps/web-admin/src/features/online/sponsor-placements.ts` queda en **dos** opciones:

| id | label | placement | tamaño recomendado |
|---|---|---|---|
| `home` | Inicio — Banner principal | `home` | 920 × 86 |
| `cantina` | Cantina — Banner promo | `cantina` | 768 × 112 |

Alta/edición: nombre, slot, imagen **o** video (`OnlineMediaUpload` ya existe), `durationSeconds`. No se agrega campo de link en esta entrega; si una fila vieja tiene `linkUrl`, el carrusel igual lo honra. `bannerLabel` deja de ruteo: se puede guardar el label del slot como texto, pero el sitio público **no** lo usa para decidir ubicación.

### Público

Un componente `SponsorCarousel`:

- Props: `slot: 'home' | 'cantina'`, lista (o se filtra adentro).
- 0 ítems → no renderiza (sin hueco).
- 1 ítem → estático (imagen o `<video muted playsInline>`).
- 2+ ítems → viewport `overflow: hidden`, track con `translateX`. El slide activo entra desde la derecha y el anterior sale a la izquierda. Duración de **permanencia** = `durationSeconds` de **ese** ítem. Transición de movimiento ~400ms, no contada aparte como dwell extra.
- Video: se reproduce solo en el slide visible; al salir, `pause()` y `currentTime = 0`. Si el video dura más que `durationSeconds`, se corta. Si dura menos, se queda en el último frame hasta el cambio.
- `prefers-reduced-motion: reduce` → sin slide; se muestra el primero.
- Click: si hay `linkUrl`, el slide es un `<a target="_blank" rel="noopener noreferrer">`.
- Media rota: placeholder con el nombre (mismo criterio que `SponsorPlacement` hoy).

Uso: HomePage banner superior; CantinaPage banner promo. **Borrar** `SponsorBanner` y `CantinaPromoBanner` duplicados.

**Borrar del layout público:** `SidebarSponsors`, `FooterSponsors`, `MobileFooterSponsors` y sus llamadas en `PublicLayout.tsx`.

## 3. Bugs visuales

La auditoría salió de leer el código, no de capturas. Antes de dar por cerrado cada ítem de layout, **verificar en navegador** (desktop y viewport móvil). El código ya alcanza para estos cambios:

### Shell y móvil (prioridad)

- Aplicar `safe-top` / `safe-bottom` (`apps/web-public/src/styles/tailwind.css`) en header móvil, nav inferior, barra sticky de cantina, `DniModal`, lightbox de fotos.
- FAB del carrito en CantinaPage: `z-40` y `bottom` por encima del nav (`bottom-24` o `calc(5rem + env(safe-area-inset-bottom))`).
- Lightbox `FotosPage`: si `type === 'video'`, `<video controls playsInline>`, no `<img>`.
- Home gallery: no usar `<img>` para ítems `video`.

### Errores de datos

Manejar `isError` (mensaje + reintentar) en `OrdersPage`, `QrPage`, `HomePage` (`home-bundle`). No mostrar “todavía no hiciste pedidos” ni “no hay QR” cuando la request falló. `CantinaPage` / `FotosPage` ya tienen error; alinear el copy.

### Imágenes

Un `SafeImage` (o equivalente mínimo) con `onError` → placeholder, `object-cover`, `alt` con el nombre del producto. Usar en menú, carrito, galería. MinIO puede 404.

### Consistencia (después de lo anterior, sin rediseñar el sitio)

- Truncar nombres largos en carrito, menú (`line-clamp`), pedido.
- Controles +/- de cantina a ~44px de área táctil.
- `focus-visible:ring` en botones y nav.
- Texto secundario: no `text-gray-600` sobre casi negro; usar `text-gray-400` / token muted.
- El doble header móvil (layout + sticky de cantina) **no** se rediseña en esta entrega salvo que la verificación en dispositivo muestre que el menú queda inutilizable. En ese caso se oculta el header del layout solo en `/cantina`.

No es objetivo de este spec migrar todo el sitio a `Button`/`Card`. `Card` sigue sin uso; no se borra acá.

## 4. Tests

Backend (`apps/api`):

- `listMenu` omite un simple cuya receta pide más stock del disponible.
- `listMenu` incluye el mismo ítem cuando hay stock.
- `listMenu` omite una promo si un componente está agotado.
- Checkout público de un id `visibleWeb: false` → 400 (aunque `active: true`).
- Checkout público crea `PedidoPublico` con `status: 'listo'`.
- `listSponsors` no devuelve `sidebar`/`footer` ni inactivos.
- Crear sponsor con `durationSeconds` fuera de 2–60 → 400.

Frontend (`apps/web-public`):

- Carrusel: 0 ítems → null; 1 ítem → sin timer de rotación; 2 ítems → el orden sigue `sortOrder` y el dwell usa `durationSeconds` del actual (test del helper de agrupación / máquina de estados, no de CSS).
- Carrito: al revalidar el menú, desaparecen ids ausentes.

## 5. Orden de implementación

1. Shell visual + errores de query + lightbox + `SafeImage` (el sitio se puede mirar mientras el resto entra).
2. API menú/checkout + UI cantina/pago/pedidos.
3. Migración sponsors + admin + `SponsorCarousel` + recorte de sidebar/footer.
4. Verificación en navegador: cantina desktop/móvil, confirmar pedido, QR, banners con 0/1/N ítems (imagen y video).

## Criterios de éxito

- Un producto sin stock no aparece en `/#/cantina`. Si se agota con el ítem ya en el carrito, `/#/carrito` lo saca y lo dice.
- Confirmar pedido no pide tarjeta. El pedido queda para retirar con QR. Cocina lo ve. Escanear el QR lo marca retirado.
- En inicio y cantina, los sponsors del slot correspondiente rotan RTL con el tiempo que puso el admin. No hay franja de sponsors en sidebar ni footer.
- En un teléfono con notch, el header y el nav no se meten bajo el sistema. El FAB de cantina es clickeable. Un video de la galería se puede reproducir en el lightbox.
- Si la API de pedidos falla, se ve un error, no una lista vacía.

## Archivos principales

| Área | Archivos |
|---|---|
| Menú / sponsors API | `apps/api/src/public/public.service.ts` |
| Checkout público | `apps/api/src/public/public-orders.service.ts` |
| Schema | `apps/api/prisma/schema.prisma` + migración |
| Sponsors admin API | `apps/api/src/sponsors/sponsors.service.ts`, DTOs |
| Admin UI | `apps/web-admin/src/features/online/sponsor-placements.ts`, `panels/SponsorsPanel.tsx` |
| Público cantina | `CantinaPage.tsx`, `CartPage.tsx`, `PaymentPage.tsx`, `OrdersPage.tsx`, `CartContext.tsx` |
| Público sponsors | nuevo `SponsorCarousel.tsx`; recorte en `PublicLayout.tsx`, `HomePage.tsx` |
| Visual | `PublicLayout.tsx`, `FotosPage.tsx`, `tailwind.css`, `ProfilePage.tsx` (sacar tarjetas) |
