# Arquitectura — Sistema de Gestión LCH

Monorepo npm (`sistema-gestion-lch`) para **La Chacra Fútbol**.

## Estructura

```
apps/
├── api/              NestJS — auth, stock, sales, kitchen, football, media
├── web-admin/        Panel interno (React + Vite)
└── web-public/       Sitio público (React + Vite)
```

## Panel admin (`apps/web-admin/src`)

| Carpeta | Responsabilidad |
|---------|-----------------|
| `app/` | Arranque, router, API client, providers globales |
| `features/` | Módulos de negocio (alineados con la API) |
| `shared/` | Hooks y utilidades sin dominio |
| `assets/` | Logos e imágenes de marca |

### Features

- **inventory** — Productos, depósitos, pedidos, proveedores, consumo, reportes
- **sales** — POS, mostrador, mesas, devoluciones, métricas
- **kitchen** — Cola de cocina (KDS)
- **online** — CMS catálogo, sponsors, multimedia
- **futbol** — Torneos y fixture
- **platform** — Login, permisos, configuración, shell de navegación

### Estado

El estado global se compone en `app/providers/use-app-state.ts` a partir de hooks por feature:

- `useInventoryState`, `useSalesState`, `useKitchenState`, `useOnlineState`, `usePlatformState`

Las claves de `localStorage` están centralizadas en `shared/storage/keys.ts` (no renombrar sin migración).

### Imports

Alias TypeScript / Vite:

- `@/app/*` — aplicación y API
- `@/features/*` — módulos
- `@/shared/*` — utilidades
- `@/assets/*` — recursos estáticos

El archivo `app/components/store.ts` reexporta tipos y `useAppState` por compatibilidad; en código nuevo preferir `@/features/*` y `@/app/providers/use-app-state`.

## API

Rutas REST por dominio (`/stock`, `/sales`, …). El prefijo `stock` en la API es el módulo de inventario; en la UI se muestra como **Inventario**.

## Base de datos (`apps/api/prisma`)

`schema.prisma` es la única fuente de verdad del modelo de datos: cualquier cambio de tabla, columna, relación o constraint se hace ahí, nunca directamente en SQL ni a mano en una migración.

El estado de la base se materializa en exactamente dos migraciones (`prisma/migrations/`):

- **`20260906120000_baseline`** — el esquema completo tal como existía al momento del corte, generado con `node scripts/generate-baseline.mjs` (script `npm run db:baseline`) a partir de `schema.prisma`. Nunca se edita a mano: si el schema cambia, se regenera desde cero.
- **`20260906120100_constraints`** — únicamente restricciones `CHECK` (rangos, enums a nivel de fila, invariantes entre columnas) agregadas sobre la baseline. No crea ni modifica tablas.

`npm run db:drift` (`apps/api`) compara `schema.prisma` contra las migraciones aplicadas y falla si difieren, para detectar si alguna migración quedó desalineada del schema.

**Política de borrado** (`onDelete` en las relaciones de `schema.prisma`):

- **`Restrict`** — catálogo con historial (por ejemplo `Producto`, `CategoriaVenta`, `Proveedor`): no se puede borrar una fila referenciada por movimientos o ventas ya registrados.
- **`Cascade`** — detalle que no existe fuera de su padre (por ejemplo ítems de un ticket, de un pedido o de un combo): al borrar el padre se borra el detalle.
- **`SetNull`** — referencias opcionales donde el registro principal debe sobrevivir aunque se borre lo referenciado (por ejemplo el usuario autor de una entrada de auditoría).

Los enums del dominio (`UnidadMedida`, `TipoMovimientoStock`, `EstadoTicket`, `RolUsuario`, etc.) viven todos juntos en el bloque `// ==================== ENUMS ====================` al principio de `schema.prisma`, antes de los modelos.

## Desarrollo local (web-admin)

- URL fija: **http://localhost:5173/** (Vite con `strictPort: true`).
- Si `npm run dev:admin` falla con “puerto en uso”, hay otro proceso (a menudo un Vite viejo) ocupando el 5173:
  ```bash
  npm run stop:admin
  npm run dev:admin
  ```
- Cerrá la terminal anterior donde corría Vite antes de volver a iniciar, para no dejar servidores huérfanos.
- Sitio público: **http://localhost:5174/** (`npm run dev:public`).

## Próximos pasos sugeridos

1. Extraer `packages/api-client` cuando `client.ts` de admin y public estén sincronizados.
2. Partir páginas grandes (`OrdersPage`, `OnlineModule`) en subcomponentes.
3. Sincronizar `web-public` con la misma convención de carpetas (solo catálogo y fútbol).
