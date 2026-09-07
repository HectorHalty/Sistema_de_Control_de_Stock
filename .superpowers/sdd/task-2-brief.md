# Brief — Task 2

Extraído de `docs/superpowers/plans/2026-09-06-integridad-esquema-bd.md`. Estos son tus requisitos: usá los valores exactos que aparecen acá, verbatim.

## Global Constraints

- Directorio raíz del repo: `D:\Desarrollo\LCH SISTEMA\Stock La Chacra Futbol\SistemaLCH\Sistema_de_Control_de_Stock`. Todas las rutas del plan son relativas a esa raíz.
- La mayoría de los comandos corren desde `apps/api`. Cada paso indica su directorio.
- El sistema está solo en desarrollo. Borrar y recrear la base es una operación esperada, no un riesgo.
- `prisma/migrations/` debe terminar con `20260906120000_baseline` y, salvo que aplique la contingencia de abajo, `20260906120100_constraints`. No debe quedar ninguna otra carpeta.
- **Contingencia sobre las `CHECK` constraints (decidida, gobierna sobre la línea anterior):** si `npm run db:drift` reporta las `CHECK` como deriva pendiente, los `CHECK` salen de `prisma/migrations/` y pasan a `scripts/apply-constraints.mjs`, expuesto como `db:constraints` y encadenado detrás de cada script que resetee la base (`test:db` y el flujo documentado en el runbook). En ese caso `prisma/migrations/` queda con una sola carpeta y el runbook tiene que decir explícitamente que `migrate reset` por sí solo no deja la base completa.
- `20260906120000_baseline/migration.sql` **nunca** se edita a mano. Se regenera con `node scripts/generate-baseline.mjs`.
- Todo SQL manual va únicamente en `20260906120100_constraints/migration.sql`, es aditivo y no contiene `DELETE`, `DROP` ni `UPDATE`.
- Los valores de cada enum son los del spec, que salen del código, no de la invención. No agregar ni renombrar valores.
- Prohibido usar `>` de PowerShell para escribir archivos de migración: la redirección puede producir UTF-16 con BOM y romper Prisma. Para eso existe `scripts/generate-baseline.mjs`.
- Cantidades de línea de venta (`ItemTicketVenta.quantity`, `ItemOrdenCocina.quantity`, `ItemComboVenta.quantity`, `ItemPedidoPublico.quantity`) se quedan en `Int`. No convertir a `Decimal`.
- No tocar transacciones, condiciones de carrera, paginación ni la capa de localStorage del admin: son los proyectos B y C.
- Base de datos de desarrollo: `postgresql://lch:lch_dev_pass@localhost:5432/lch_stock?schema=public`
- Base de datos de tests: `postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_test?schema=public`
- Base shadow para el chequeo de deriva: `postgresql://lch:lch_dev_pass@localhost:5432/lch_stock_shadow?schema=public`


---

### Task 2: Aplastar las 7 migraciones en una baseline generada

Se hace **antes** de cambiar el schema, para que si algo se rompe se sepa que fue el aplastado y no una corrección de esquema. El schema no cambia en esta tarea.

**Files:**
- Create: `apps/api/scripts/generate-baseline.mjs`
- Create: `apps/api/prisma/migrations/20260906120000_baseline/migration.sql` (generado)
- Delete: `apps/api/prisma/migrations/20250618130000_init/`
- Delete: `apps/api/prisma/migrations/20260820120000_optimize_spanish_schema/`
- Delete: `apps/api/prisma/migrations/20260831104500_public_platform_phase_a1/`
- Delete: `apps/api/prisma/migrations/20260901120000_online_menu_web_sponsors/`
- Delete: `apps/api/prisma/migrations/20260902120000_public_auth_db_optimize/`
- Delete: `apps/api/prisma/migrations/20260904120000_ticket_stock_allocations/`
- Delete: `apps/api/prisma/migrations/20260904180000_admin_settings/`
- Modify: `apps/api/package.json` (script `db:baseline`)

**Interfaces:**
- Consumes: `npm run test:db` y `npm run db:drift` de la Task 1.
- Produces: `node scripts/generate-baseline.mjs` — borra y regenera `prisma/migrations/20260906120000_baseline/migration.sql` desde `schema.prisma`. Lo usan todas las tareas de dominio siguientes.

- [ ] **Step 1: Crear el generador de baseline**

Crear `apps/api/scripts/generate-baseline.mjs`. Captura stdout y escribe con `utf8` explícito, en lugar de redirigir con el shell.

```javascript
#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join('prisma', 'migrations', '20260906120000_baseline');

const result = spawnSync(
  'npx',
  [
    'prisma',
    'migrate',
    'diff',
    '--from-empty',
    '--to-schema-datamodel',
    'prisma/schema.prisma',
    '--script',
  ],
  { encoding: 'utf8', shell: true },
);

if (result.status !== 0) {
  console.error(result.stderr);
  process.exit(result.status ?? 1);
}

const sql = result.stdout;
if (!sql.includes('CREATE TABLE')) {
  console.error('La baseline generada no contiene ningún CREATE TABLE. Abortando.');
  process.exit(1);
}

rmSync(DIR, { recursive: true, force: true });
mkdirSync(DIR, { recursive: true });
writeFileSync(join(DIR, 'migration.sql'), sql, 'utf8');

console.log(`Baseline regenerada: ${join(DIR, 'migration.sql')} (${sql.length} bytes)`);
```

- [ ] **Step 2: Agregar el script a package.json**

En `apps/api/package.json`, agregar dentro de `"scripts"`, después de `"db:drift"`:

```json
    "db:baseline": "node scripts/generate-baseline.mjs",
```

- [ ] **Step 3: Borrar las 7 migraciones viejas**

Desde `apps/api`:

```bash
git rm -r prisma/migrations/20250618130000_init prisma/migrations/20260820120000_optimize_spanish_schema prisma/migrations/20260831104500_public_platform_phase_a1 prisma/migrations/20260901120000_online_menu_web_sponsors prisma/migrations/20260902120000_public_auth_db_optimize prisma/migrations/20260904120000_ticket_stock_allocations prisma/migrations/20260904180000_admin_settings
```

- [ ] **Step 4: Generar la baseline**

Desde `apps/api`:

```bash
npm run db:baseline
```

Esperado: `Baseline regenerada: prisma\migrations\20260906120000_baseline\migration.sql (NNNNN bytes)`, con un tamaño de decenas de miles de bytes.

- [ ] **Step 5: Verificar que la baseline no tiene SQL destructivo**

Desde `apps/api`:

```bash
rg -n "^(DELETE|DROP|UPDATE|ALTER TABLE .* RENAME)" prisma/migrations/20260906120000_baseline/migration.sql
```

Esperado: sin salida. Una baseline desde vacío solo crea.

- [ ] **Step 6: Recrear la base de desarrollo desde la baseline**

Desde `apps/api`:

```bash
npx prisma migrate reset --force
```

Esperado: aplica una sola migración (`20260906120000_baseline`) y corre el seed sin errores.

- [ ] **Step 7: Verificar que no hay deriva**

Desde `apps/api`:

```bash
npm run db:drift
```

Esperado: `Sin deriva: schema.prisma y prisma/migrations coinciden.`

Si en cambio reporta deriva, el schema tiene algo que `migrate diff --from-empty` no reproduce. Leer el diff que imprime y corregir el schema antes de seguir; no editar la baseline a mano.

- [ ] **Step 8: Verificar que la suite completa sigue verde**

Desde `apps/api`:

```bash
npm run test:db
npm test
```

Esperado: ambas PASS.

- [ ] **Step 9: Commit**

```bash
git add -A apps/api/prisma/migrations apps/api/scripts/generate-baseline.mjs apps/api/package.json
git commit -m "refactor(db): aplastar 7 migraciones en una baseline generada

La segunda migración estaba escrita a mano con DELETE de huérfanos,
deduplicaciones y renombres de 27 tablas, y otra insertaba datos con
UUIDs hardcodeados que fallan al reaplicarse. La baseline se genera con
prisma migrate diff y no se edita nunca a mano."
```
