# Arquitectura — Sistema de Gestión LCH

Monorepo npm (`sistema-gestion-lch`) para **La Chacra Fútbol**.

## Estructura

```
apps/
├── api/              NestJS — auth, stock, sales, kitchen, online-catalog, football, media
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

## Próximos pasos sugeridos

1. Extraer `packages/api-client` cuando `client.ts` de admin y public estén sincronizados.
2. Partir páginas grandes (`OrdersPage`, `OnlineModule`) en subcomponentes.
3. Sincronizar `web-public` con la misma convención de carpetas (solo catálogo y fútbol).
