# Proyecto C — Fuente de verdad del admin — Diseño

Borrador inicial. Alcance definido en el spec de Plan A
(`2026-09-06-integridad-esquema-bd-design.md`, sección "Fuera de alcance") y
repetido en el de Plan B:

> Eliminación del localStorage-first del admin, invalidación de caché y
> errores visibles al guardar (proyecto C).

## Problema

El admin (`apps/web-admin`) no tiene una única forma de hablar con la API.
Conviven dos arquitecturas:

1. **`app/api/adapters.ts`** (más nueva, usada por checkout/impresión/SSE de
   cocina/sponsors/media): "API es la fuente de verdad; los errores se
   muestran al operador en vez de escribirse en localStorage en silencio"
   (comentario literal del archivo). Sin caché de datos — cada hook pide lo
   que necesita, expone `apiAvailable`, y errores como `{ ok: false }` que el
   caller decide cómo mostrar.
2. **Los 6 hooks `use-*-state.ts`** (inventario, ventas, fútbol, cocina,
   online, plataforma): estado inicial leído **síncronamente de
   `localStorage`** antes de que exista respuesta de la API, hidratado
   después en un `useEffect`, y cada mutación hace un update optimista local
   + reintenta re-hidratar en background. `localStorage` es la fuente de
   verdad inicial; la API la corrige después, si puede.

Proyecto C es sobre el segundo grupo. Los 6 archivos:

| Archivo | Líneas | Dominio |
|---|---:|---|
| `features/inventory/use-inventory-state.ts` | 770 | Productos, stock, proveedores, órdenes de compra |
| `features/sales/use-sales-state.ts` | 676 | Productos de venta, tickets, historial |
| `features/platform/use-platform-state.ts` | 93 | Configuración general |
| `features/online/use-online-settings.ts` | 60 | Config. cantina online |
| `features/kitchen/use-kitchen-state.ts` | 54 | Órdenes de cocina (solo lectura local) |
| `features/futbol/use-futbol-settings.ts` | 49 | Config. fútbol |

## Hallazgos concretos

### 1. localStorage-first en los 6 hooks

Patrón idéntico en los 6 (ejemplo de `use-kitchen-state.ts:43`):

```ts
const [kitchenOrders, setKitchenOrders] = useLocalStorage<KitchenOrder[]>(storageKeys.kitchen.orders, []);
useEffect(() => {
  void kitchenApi.orders.list().then(rows => setKitchenOrders(rows.map(mapApiKitchenOrder)))
    .catch(() => undefined); // silencioso
}, [setKitchenOrders]);
```

Consecuencias reales, no hipotéticas:
- Al abrir el admin, la UI muestra por una fracción de segundo (o más, si la
  API tarda o falla) datos de `localStorage` — que pueden ser de hace días,
  de otro usuario en el mismo navegador, o de antes de un cambio hecho desde
  otro dispositivo.
- Si la API falla al hidratar, el catch es silencioso
  (`.catch(() => undefined)` en `use-kitchen-state.ts:48`, y equivalente en
  los otros 5) — el operador sigue viendo datos viejos sin ningún aviso de
  que no se actualizaron.
- `use-inventory-state.ts` y `use-sales-state.ts` (los dos grandes) además
  hacen *escritura* optimista a `localStorage` en cada mutación, antes de
  confirmar con el servidor — es lo que hizo que la Task 10 de Plan B no
  pudiera agregar paginación real sin romper el resto: todas las pantallas
  asumen tener el dataset completo en memoria/localStorage.

### 2. Invalidación de caché — reachability cache con TTL fijo

`app/api/adapters.ts:30-58`:

```ts
let reachabilityCache: { promise: Promise<boolean>; at: number } | null = null;
const REACHABILITY_TTL_MS = 30_000;
export async function isApiReachable(): Promise<boolean> { /* usa el cache si < 30s */ }
export function clearApiReachabilityCache(): void { reachabilityCache = null; }
```

`clearApiReachabilityCache()` ya se invoca manualmente en algunos catches de
red (`use-inventory-state.ts`, visto en Plan B), pero no en todos — es un
mecanismo ad-hoc, invocado donde alguien se acordó, no una regla. Efecto
real: si la API se cae y se recupera dentro de la ventana de 30s, el admin
puede seguir creyendo que no hay API disponible hasta que expire el TTL o
alguien dispare manualmente la limpieza.

### 3. Errores visibles al guardar — parcial, no sistemático

Relevado en profundidad `use-inventory-state.ts` (25 bloques `catch`, cero
llamadas a `alert`/`toast`/`setError` — el hook siempre re-lanza después de
reintentar re-hidratar) y sus 3 páginas principales
(`ProductsPage.tsx`, `SuppliersPage.tsx`, `OrdersPage.tsx`): **ahí sí**
cada caller envuelve en `try/catch` y muestra `window.alert(...)`. Mismo
patrón confirmado en `VentasPosContext.tsx` (usa `setToast`, no `alert`, pero
sí visible). **No se relevaron todas las pantallas de fútbol/online/settings**
— es candidato a sorpresas si algún formulario de esos dominios no sigue la
misma disciplina. La falla real y confirmada está en la **hidratación**, no
en el guardado: los 6 `useEffect` de carga inicial fallan en silencio.

## Restricciones del contexto

- El admin es la herramienta de uso diario del negocio (ventas, cocina,
  stock) — cualquier regresión acá es directamente operativa, no cosmética.
  No se puede migrar "todo de una" sin arriesgar el día a día.
- No hay al momento ningún framework de data-fetching (React Query, SWR,
  Apollo) en `package.json` de `web-admin` — la elección de si sumar uno o
  resolverlo a mano es una decisión de este proyecto, no algo ya decidido.
- Los `use-*-state.ts` grandes (inventario, ventas) alimentan a su vez el
  POS (`VentasPosContext.tsx`) y varias páginas — no son solo listados, hay
  lógica de negocio de por medio (asignación de códigos de producto, merge
  de pendientes locales con datos del servidor, etc.) que hay que preservar.
- Plan B ya dejó paginación por cursor lista y compatible en el backend para
  varios de estos listados — este proyecto es quien puede aprovecharla.

## Decisiones tomadas

1. **Librería de data-fetching: TanStack Query (React Query) v5.** Maneja
   caché, revalidación, reintentos y — clave para la decisión 3 — el patrón
   `onMutate`/`onError`/`onSettled` para optimismo con rollback explícito sin
   reinventar esa máquina de estados a mano. Se suma como dependencia nueva
   de `apps/web-admin`.
2. **Alcance: Inventario y Ventas primero.** Son los 2 hooks grandes (770 y
   676 líneas), los únicos con mutaciones reales y los que alimentan el POS.
   Fútbol, online, cocina y plataforma (49-93 líneas, mayormente config de
   lectura) quedan para una pasada posterior — no bloquean nada de esto.
3. **Escritura optimista: se mantiene, con reconciliación explícita.** Cada
   mutación sigue reflejando el cambio al instante; si el servidor la
   rechaza, `onError` revierte el cache de React Query al estado anterior
   (snapshot tomado en `onMutate`) y dispara la notificación de error de la
   decisión 4. El admin no pierde la sensación de instantáneo.
4. **Errores visibles: notificación global centralizada.** Un
   `MutationCache`/`QueryCache` de React Query con `onError` por defecto
   dispara un toast común para cualquier mutación o query que falle, además
   de los `try/catch` puntuales que ya existen en algunas pantallas (quedan,
   no estorban — son cinturón y tirantes).
5. **`localStorage` pasa de "fuente de verdad inicial" a "caché de lectura
   offline".** Se usa el persister oficial de React Query
   (`@tanstack/query-sync-storage-persister` +
   `@tanstack/react-query-persist-client`) para que el cache sobreviva un
   refresh y sirva de fallback sin red — sin mantener a mano la lectura
   síncrona de `localStorage` que hace cada uno de los 6 hooks hoy.

## Fuera de alcance

- Proyectos A y B, ya completos.
- Rediseño visual de cualquier pantalla.
- Migrar el POS de tickets locales offline-first a un modelo sin caché
  local — el POS necesita seguir funcionando con la red caída (es su
  requisito de negocio explícito, no un descuido).
