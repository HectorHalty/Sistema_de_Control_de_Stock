# Sistema de Gestión LCH — Runbook

Guía de instalación y desarrollo del sistema de gestión para **La Chacra Fútbol** (arquitectura local-first con monorepo).

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Admin Frontend (React + Vite + TypeScript)     │
│  apps/web-admin/                                 │
│  - Login, dashboard, stock, ventas, online,     │
│    futbol admin, kitchen display, settings      │
│  - API adapter hooks with localStorage fallback │
│  - SSE client for real-time kitchen updates     │
│  - Port: 5173                                    │
└────────────────┬────────────────────────────────┘
                 │ HTTP / JSON + SSE
┌────────────────▼────────────────────────────────┐
│  Public Frontend (React + Vite + TypeScript)    │
│  apps/web-public/                                │
│  - Tournament standings, canteen menu,          │
│    media gallery, online product catalog        │
│  - Read-only API adapters with localStorage     │
│  - Port: 5174                                    │
└────────────────┬────────────────────────────────┘
                 │ HTTP / JSON
┌────────────────▼────────────────────────────────┐
│  Backend (NestJS + Prisma + PostgreSQL)         │
│  apps/api/                                       │
│  ├── auth        - JWT auth (bcrypt, rate-limited)  │
│  ├── stock       - Products, warehouses, stock  │
│  ├── sales       - Menu, checkout, tickets      │
│  ├── kitchen     - KDS order transitions + SSE  │
│  ├── media       - Real presigned S3 uploads    │
│  ├── sponsors    - Sponsor CRUD                 │
│  ├── football    - Teams, matches, standings    │
│  ├── online-catalog - Online product catalog    │
│  └── sse         - Server-Sent Events stream    │
└────────────────┬────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────┐
│  Infrastructure (Docker Compose)                │
│  - PostgreSQL 16 (primary DB)                   │
│  - Redis 7 (caching/sessions)                   │
│  - MinIO (S3-compatible object storage)         │
└─────────────────────────────────────────────────┘

Mobile (Capacitor)          Desktop (Electron)
┌──────────────────┐        ┌──────────────────┐
│ web-admin → APK  │        │ web-admin → .exe │
│ web-public → APK │        │ web-public → .exe│
└──────────────────┘        └──────────────────┘
```

## Prerequisites

- **Node.js** 20+
- **Docker** + Docker Compose
- **npm** (or pnpm)

## Quick Start

### 1. Start infrastructure

```bash
npm run dev:infra
```

This starts PostgreSQL (5432), Redis (6379), and MinIO (9000/9001).
MinIO buckets are auto-created by the init service.
Wait ~10 seconds for all services to be healthy.

### 2. Set up the API

```bash
cd apps/api
cp .env.example .env
npm install
npx prisma migrate dev
npm run prisma:seed
```

### 3. Run the backend

```bash
npm run dev:api
```

API runs on `http://localhost:3001`
Swagger docs at `http://localhost:3001/api/docs`
SSE events at `http://localhost:3001/sse/events`

### 4. Run the frontends

**Admin app** (internal management):

```bash
npm run dev:admin
```

Runs on `http://localhost:5173`

**Public site** (client-facing):

```bash
npm run dev:public
```

Runs on `http://localhost:5174`

**Both at once**:

```bash
npm run dev:webs
```

**Everything (infra + api + both frontends)**:

```bash
npm run dev:all
```

## Environment Variables

### Backend (`apps/api/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql://lch:lch_dev_pass@localhost:5432/lch_stock` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `NODE_ENV` | `development` | Set to `production` for prod mode |
| `JWT_SECRET` | `dev-secret` (dev only) | **REQUIRED in production**: min 32 chars, not a common word |
| `JWT_EXPIRES_IN` | `1h` | Token expiry (reduced from 24h) |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:5174` | Comma-separated CORS allowlist (prod only) |
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_PORT` | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | `minio_admin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minio_dev_pass` | MinIO secret key |
| `MINIO_USE_SSL` | `false` | Use HTTPS for MinIO |
| `MINIO_BUCKET_MEDIA` | `lch-media` | Media bucket name |
| `PORT` | `3001` | API port |

> **PRODUCTION SECURITY**: The API will **refuse to start** if `JWT_SECRET` is unset, empty, or a known weak value when `NODE_ENV=production`. Generate a strong secret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"`

### Frontend (`.env` or `.env.local` in each app)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:3001` | Backend API base URL |

## Mobile Development (Capacitor)

Each app has its own Capacitor configuration:

| App | App ID | Config |
|-----|--------|--------|
| Admin | `com.lch.admin` | `apps/web-admin/capacitor.config.json` |
| Public | `com.lch.public` | `apps/web-public/capacitor.config.json` |

### Sync native projects

```bash
npm run cap:sync:admin
npm run cap:sync:public
```

### Open in Android Studio

```bash
npm run cap:open:admin
npm run cap:open:public
```

### Run on device/emulator

```bash
npm run cap:run:admin
npm run cap:run:public
```

## Desktop Packaging (Electron)

Each app has its own Electron entry point with secure defaults:
- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`

### Build desktop apps

```bash
npm run electron:admin    # builds apps/web-admin/release/
npm run electron:public   # builds apps/web-public/release/
```

## API Endpoints

### Health
- `GET /health` - Health check (used by frontend to detect API availability)

### Auth
- `POST /auth/login` - Login (bcrypt-validated, rate-limited, no auto-provisioning)

> **Note**: Users must be created via seed script or admin API. The login endpoint no longer auto-provisions accounts.

### Stock
- `GET /stock/products` - List products
- `POST /stock/products` - Create product
- `PUT /stock/products/:id` - Update product
- `DELETE /stock/products/:id` - Delete product
- `POST /stock/products/:id/stock/adjust` - Adjust stock level
- `GET /stock/warehouses` - List warehouses
- `GET /stock/categories` - List categories

### Sales
- `GET /sales/products` - List menu products
- `POST /sales/products` - Create menu product
- `PUT /sales/products/:id` - Update menu product
- `POST /sales/checkout` - **Transactional checkout** (idempotent)
- `POST /sales/return` - **Transactional return** (idempotent)
- `GET /sales/tickets` - List tickets
- `POST /sales/tickets/:id/void` - Void ticket
- `GET /sales/kitchens` - List kitchens

### Kitchen Display
- `GET /kitchen/orders` - List orders (filter by kitchenId, status)
- `GET /kitchen/orders/:id` - Get order
- `POST /kitchen/orders/:id/transition` - Transition order state
- `GET /kitchen/kitchens/:kitchenId/active-orders` - Active orders for kitchen

### SSE (Real-time)
- `GET /sse/events?kitchenId=xxx` - SSE stream for kitchen updates

### Media
- `POST /media/presign` - Get **real presigned** upload URL (AWS SDK v3)
- `POST /media/confirm` - Confirm upload and persist metadata
- `GET /media` - List media items
- `DELETE /media/:id` - Delete media

### Sponsors
- `GET /sponsors` - List sponsors
- `POST /sponsors` - Create sponsor
- `PUT /sponsors/:id` - Update sponsor
- `DELETE /sponsors/:id` - Delete sponsor

### Football
- `GET /football/teams` - List teams
- `POST /football/teams` - Create team
- `GET /football/matches` - List matches
- `POST /football/matches` - Create match
- `PUT /football/matches/:id/score` - Set match score
- `GET /football/standings` - Get standings (computed)

### Online Catalog
- `GET /online-catalog/products` - List products
- `POST /online-catalog/products` - Create product
- `PUT /online-catalog/products/:id` - Update product
- `DELETE /online-catalog/products/:id` - Delete product

## Transactional Guarantees

### Checkout Flow
1. Validates idempotency key (if provided)
2. Validates sales products exist and are active
3. Builds required stock quantities from recipes
4. **Locks stock rows** with `SELECT ... FOR UPDATE`
5. Validates availability atomically
6. Deducts stock within the same transaction
7. Creates ticket and kitchen orders
8. All or nothing — no partial state

### Return Flow
1. Validates ticket exists and is returnable
2. Calculates stock to restore from recipes
3. Restores stock atomically
4. Updates ticket status to `devuelto`

### Kitchen Transitions
Strict state machine: `pending → preparing → ready → delivered`
No backward or skip transitions allowed.
SSE broadcast on every successful transition.

## Media Upload Flow (Real Presigned URLs)

1. Client calls `POST /media/presign` with file metadata (type, fileName, mimeType, size)
2. Server validates MIME type and size, generates **real AWS SDK v3 presigned URL** for MinIO
3. Client uploads directly to MinIO via PUT to the presigned URL
4. Client calls `POST /media/confirm` with key and metadata to persist in database
5. Presigned URLs expire after 1 hour

## Real-time Kitchen Updates (SSE)

1. Frontend KDS connects to `GET /sse/events?kitchenId=xxx`
2. Server keeps connection open with `text/event-stream`
3. On every kitchen order transition, server broadcasts `kitchen-order-updated` event
4. Frontend refreshes orders list automatically
5. No polling needed — true server push

## Frontend API Adapters

Both frontends use adapter hooks (`src/app/api/adapters.ts`) that:
- Check API availability via `/health` endpoint
- Use API endpoints as primary data source
- Fall back to localStorage if API unreachable
- Provide loading/error states for UX consistency

Available adapters:
- `useSalesApiAdapter()` - checkout, return
- `useKitchenApiAdapter(kitchenId?)` - orders list, transitions, SSE
- `useMediaApiAdapter()` - presign, confirm, list, delete
- `useSponsorsApiAdapter()` - CRUD
- `useOnlineCatalogApiAdapter()` - CRUD

## Testing

```bash
# All tests (both frontends + API)
npm test

# API tests only
npm run test:api

# Admin frontend tests only
npm run test:admin

# Public frontend tests only
npm run test:public
```

## Known Limitations

- No pagination on list endpoints yet
- Stock deduction uses raw SQL for composite key updates (Prisma limitation — now uses parameterized `$queryRaw`/`$executeRaw`)
- Frontend components still use localStorage directly — adapters exist but not yet wired into all components
- SSE does not handle reconnection backoff (browser handles basic retry)
- Admin "Ver sitio publico" button opens the public app in a new browser tab (native builds open system browser)
- Login attempt tracking is in-memory (use Redis for multi-instance deployments)
- 28 npm audit vulnerabilities remain (mostly in dev dependencies; see `npm audit` output)

## Security Hardening (Applied 2026-05-19)

The following security remediations have been applied:

1. **Auth**: bcrypt password hashing, login rate limiting (20 attempts/15min in prod), account lockout, no auto-provisioning
2. **JWT**: Strong secret enforcement (fails startup if weak in production), reduced expiry to 1h
3. **Access Control**: JWT guard + RBAC on all mutating endpoints (Admin/SuperAdmin only for POST/PUT/DELETE)
4. **SQL Injection**: All `$queryRawUnsafe`/`$executeRawUnsafe` replaced with parameterized `$queryRaw`/`$executeRaw`
5. **Headers**: Helmet security headers (CSP, X-Frame-Options, etc.)
6. **Rate Limiting**: Per-endpoint rate limiting (stricter on auth)
7. **CORS**: Env-based origin allowlist in production
8. **Validation**: UUID validation on ID fields, max length constraints on strings
9. **Audit Logging**: Server-side logging for login attempts and critical mutations
