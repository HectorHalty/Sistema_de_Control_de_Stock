# Sistema de Control de Stock — La Chacra Futbol

Stock management system for La Chacra Futbol club.

## Security

This API includes security hardening:
- **bcrypt** password hashing (no plaintext passwords)
- **JWT** with strong secret enforcement (fails startup if weak in production)
- **Rate limiting** on auth (20 attempts/15min) and general API
- **RBAC** guards on all mutating endpoints (Admin/SuperAdmin only)
- **Helmet** security headers and CSP
- **Parameterized queries** (no raw SQL injection surface)
- **Audit logging** for login attempts and mutations

> **Production**: Set `NODE_ENV=production` and generate a strong `JWT_SECRET` (min 32 chars).
> The API will refuse to start without it.

## Architecture

```
apps/
├── api/              Backend (NestJS + Prisma + PostgreSQL)
├── web-admin/        Admin frontend (React + Vite + TypeScript)
│                     Internal: stock, ventas, online CMS, futbol admin, kitchen
└── web-public/       Public frontend (React + Vite + TypeScript)
                      Client-facing: tournament, canteen, media gallery
```

Both frontends consume the same API at `apps/api`. Each frontend is independently
packaged for web, mobile (Capacitor), and desktop (Electron).

## Quick Start

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for full setup instructions.

```bash
# 1. Start infrastructure
npm run dev:infra

# 2. Set up API
cd apps/api && cp .env.example .env && npm install
npx prisma migrate dev && npm run prisma:seed
npm run dev:api

# 3. Run frontends (separate terminals)
npm run dev:admin     # http://localhost:5173
npm run dev:public    # http://localhost:5174
```

## Root Scripts

| Command | Description |
|---------|-------------|
| `npm run dev:infra` | Start Docker infrastructure (PostgreSQL, Redis, MinIO) |
| `npm run dev:api` | Start the backend API |
| `npm run dev:admin` | Start the admin frontend |
| `npm run dev:public` | Start the public frontend |
| `npm run dev:webs` | Start both frontends together |
| `npm run dev:all` | Start everything (infra + api + both frontends) |
| `npm run test` | Run all tests |
| `npm run test:admin` | Admin tests only |
| `npm run test:public` | Public tests only |
| `npm run test:api` | API tests only |
| `npm run cap:sync:admin` | Sync Capacitor for admin app |
| `npm run cap:sync:public` | Sync Capacitor for public app |
| `npm run cap:open:admin` | Open admin Android project in Android Studio |
| `npm run cap:open:public` | Open public Android project in Android Studio |
| `npm run electron:admin` | Build admin desktop app |
| `npm run electron:public` | Build public desktop app |

## Tests

```bash
npm test              # all tests
npm run test:api      # API only
npm run test:admin    # Admin frontend only
npm run test:public   # Public frontend only
```
