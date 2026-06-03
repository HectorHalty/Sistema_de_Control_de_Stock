# Sistema de Gestión LCH

**Sistema de gestión integral** para **La Chacra Fútbol**, el complejo deportivo y club de la empresa. Centraliza el trabajo diario de operaciones, stock, ventas en cantina, catálogo online y módulos deportivos en una sola plataforma.

## ¿Qué hace?

| Área | Funcionalidad |
|------|----------------|
| **Stock** | Productos, depósitos, movimientos, control de stock y registro de consumo interno |
| **Compras** | Pedidos a proveedores y seguimiento |
| **Ventas** | Punto de venta (mostrador y mesas), historial, devoluciones y reportes |
| **Online** | Catálogo y contenido para la web pública |
| **Fútbol** | Equipos, partidos y tablas (administración interna) |
| **Sitio público** | Torneos, cantina, galería y catálogo para visitantes |

El panel **admin** (`apps/web-admin`) lo usan empleados con roles (SuperAdmin, gerencia, encargados). El sitio **público** (`apps/web-public`) es la cara visible para socios y visitantes. Ambos se conectan al mismo backend (`apps/api`).

## Arquitectura

```
apps/
├── api/           Backend (NestJS + Prisma + PostgreSQL)
├── web-admin/     Panel interno (React + Vite) — organizado por features
└── web-public/    Sitio público (React + Vite)
```

Documentación detallada: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

Cada frontend puede publicarse en web, empaquetarse con **Capacitor** (Android) o **Electron** (escritorio).

## Inicio rápido

Instrucciones detalladas: [docs/RUNBOOK.md](docs/RUNBOOK.md).

```bash
# 1. Infraestructura (Docker)
npm run dev:infra

# 2. API
cd apps/api && cp .env.example .env && npm install
npx prisma migrate dev && npm run prisma:seed
npm run dev:api

# 3. Frontends (terminales separadas)
npm run dev:admin     # http://localhost:5173
npm run dev:public    # http://localhost:5174
```

## Scripts principales

| Comando | Descripción |
|---------|-------------|
| `npm run dev:infra` | PostgreSQL, Redis y MinIO (Docker) |
| `npm run dev:api` | Backend |
| `npm run dev:admin` | Panel de gestión LCH |
| `npm run dev:public` | Sitio público |
| `npm run dev:webs` | Ambos frontends |
| `npm run dev:all` | Infra + API + ambos frontends |
| `npm test` | Tests de todos los workspaces |

## Seguridad (API)

- Contraseñas con **bcrypt**
- **JWT** (secreto obligatorio en producción)
- **Rate limiting** en autenticación
- **RBAC** en endpoints sensibles
- **Helmet**, consultas parametrizadas y auditoría

En producción: `NODE_ENV=production` y `JWT_SECRET` de al menos 32 caracteres.

## Licencia y empresa

Desarrollado para **La Chacra Fútbol** — gestión operativa del complejo (LCH).
