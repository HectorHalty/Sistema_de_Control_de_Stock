# Brief — Task 3

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

### Task 3: Traducción de errores Prisma a HTTP

Sin esto, las restricciones que agregan las tareas 4 a 8 devuelven errores 500 crudos en lugar de 409 o 400, y el admin no puede distinguir "dato duplicado" de "la API se cayó".

**Files:**
- Create: `apps/api/src/common/prisma-exception.filter.ts`
- Modify: `apps/api/src/common/prisma-errors.ts` (archivo completo, hoy 3 líneas)
- Modify: `apps/api/src/main.ts` (registro del filtro global)
- Modify: `apps/api/src/sales/sales.service.ts:29-31` (quitar la copia local del chequeo P2002)
- Modify: `apps/api/src/football/football.service.ts:217-229` y `:264-274` (catches desnudos)
- Test: `apps/api/test/unit/prisma-errors.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces, desde `src/common/prisma-errors.ts`:
  - `isPrismaUniqueConflict(e: unknown): boolean` (ya existía)
  - `isPrismaForeignKeyViolation(e: unknown): boolean`
  - `isPrismaRecordNotFound(e: unknown): boolean`
  - `PrismaExceptionFilter` desde `src/common/prisma-exception.filter.ts`, registrado con `app.useGlobalFilters()`.

- [ ] **Step 1: Escribir los tests que fallan**

Crear `apps/api/test/unit/prisma-errors.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  isPrismaUniqueConflict,
  isPrismaForeignKeyViolation,
  isPrismaRecordNotFound,
} from '../../src/common/prisma-errors';

describe('prisma-errors', () => {
  it('reconoce P2002 como conflicto de unicidad', () => {
    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
    expect(isPrismaUniqueConflict({ code: 'P2003' })).toBe(false);
  });

  it('reconoce P2003 como violación de clave foránea', () => {
    expect(isPrismaForeignKeyViolation({ code: 'P2003' })).toBe(true);
    expect(isPrismaForeignKeyViolation({ code: 'P2002' })).toBe(false);
  });

  it('reconoce P2025 como registro no encontrado', () => {
    expect(isPrismaRecordNotFound({ code: 'P2025' })).toBe(true);
    expect(isPrismaRecordNotFound({ code: 'P2002' })).toBe(false);
  });

  it('no explota con valores que no son objetos', () => {
    for (const value of [null, undefined, 'P2002', 42]) {
      expect(isPrismaUniqueConflict(value)).toBe(false);
      expect(isPrismaForeignKeyViolation(value)).toBe(false);
      expect(isPrismaRecordNotFound(value)).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Correr los tests para verificar que fallan**

Desde `apps/api`:

```bash
npx vitest run test/unit/prisma-errors.test.ts
```

Esperado: FAIL. `isPrismaForeignKeyViolation` e `isPrismaRecordNotFound` no existen.

- [ ] **Step 3: Ampliar los helpers**

Reemplazar el contenido completo de `apps/api/src/common/prisma-errors.ts`:

```typescript
function prismaCode(e: unknown): string | undefined {
  if (typeof e !== 'object' || e === null) return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

/** P2002 — violación de una constraint única. */
export function isPrismaUniqueConflict(e: unknown): boolean {
  return prismaCode(e) === 'P2002';
}

/** P2003 — violación de una clave foránea. */
export function isPrismaForeignKeyViolation(e: unknown): boolean {
  return prismaCode(e) === 'P2003';
}

/** P2025 — la operación esperaba un registro que no existe. */
export function isPrismaRecordNotFound(e: unknown): boolean {
  return prismaCode(e) === 'P2025';
}
```

- [ ] **Step 4: Correr los tests para verificar que pasan**

Desde `apps/api`:

```bash
npx vitest run test/unit/prisma-errors.test.ts
```

Esperado: PASS, 4 tests.

- [ ] **Step 5: Crear el filtro global**

Crear `apps/api/src/common/prisma-exception.filter.ts`. Es la red de seguridad para lo que ningún servicio atrapó; los servicios que ya lanzan mensajes de dominio específicos siguen ganando porque lanzan `HttpException` antes de llegar acá.

```typescript
import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const STATUS_BY_CODE: Record<string, { status: number; message: string }> = {
  P2002: {
    status: HttpStatus.CONFLICT,
    message: 'Ya existe un registro con esos datos.',
  },
  P2003: {
    status: HttpStatus.BAD_REQUEST,
    message: 'El registro referenciado no existe.',
  },
  P2025: {
    status: HttpStatus.NOT_FOUND,
    message: 'El registro no existe.',
  },
};

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(PrismaExceptionFilter.name);

  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const mapped = STATUS_BY_CODE[exception.code];

    if (!mapped) {
      this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Error interno de base de datos.',
      });
      return;
    }

    const target = exception.meta?.target;
    this.logger.warn(`Prisma ${exception.code} en ${JSON.stringify(target)}`);

    response.status(mapped.status).json({
      statusCode: mapped.status,
      message: mapped.message,
      prismaCode: exception.code,
      target,
    });
  }
}
```

- [ ] **Step 6: Registrar el filtro en main.ts**

En `apps/api/src/main.ts`, justo después del bloque `app.useGlobalPipes(new ValidationPipe({...}))` que está en las líneas 135-141, agregar:

```typescript
  app.useGlobalFilters(new PrismaExceptionFilter());
```

Y agregar el import al inicio del archivo, junto a los demás imports locales:

```typescript
import { PrismaExceptionFilter } from './common/prisma-exception.filter';
```

- [ ] **Step 7: Quitar la copia local del chequeo P2002 en sales**

En `apps/api/src/sales/sales.service.ts`, borrar la función local de las líneas 29-31 (la que compara `code === 'P2002'`) y usar el helper compartido. Agregar al bloque de imports:

```typescript
import { isPrismaUniqueConflict } from '../common/prisma-errors';
```

Reemplazar cada llamada a la función local por `isPrismaUniqueConflict`. Verificar que no queda ninguna referencia:

```bash
rg -n "P2002" apps/api/src/sales/sales.service.ts
```

Esperado: sin salida.

- [ ] **Step 8: Hacer que los catches de football discriminen por código**

En `apps/api/src/football/football.service.ts`, el bloque de las líneas 217-229 atrapa cualquier error y lo reporta como equipo ya inscripto, incluyendo fallas de conexión. Reemplazarlo por:

```typescript
    try {
      return await this.prisma.equipoInscripcion.create({ data: inscriptionData });
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException('El equipo ya está inscripto en este torneo');
      }
      throw e;
    }
```

Aplicar el mismo patrón al bloque de `createCaptain` en las líneas 264-274, conservando su mensaje original de conflicto. Agregar el import:

```typescript
import { isPrismaUniqueConflict } from '../common/prisma-errors';
```

Nota: `inscriptionData` es el objeto `data` que el código actual ya construye inline dentro del `create`. Mantener la construcción tal como está; el único cambio es el `catch`.

- [ ] **Step 9: Verificar compilación y suite**

Desde `apps/api`:

```bash
npm run build
npm test
```

Esperado: ambas PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/common/prisma-errors.ts apps/api/src/common/prisma-exception.filter.ts apps/api/src/main.ts apps/api/src/sales/sales.service.ts apps/api/src/football/football.service.ts apps/api/test/unit/prisma-errors.test.ts
git commit -m "feat(api): traducir errores Prisma a códigos HTTP

P2002 a 409, P2003 a 400 y P2025 a 404 mediante un filtro global. Sin
esto, las restricciones que agregan las tandas de esquema devolverían
500 crudos. Los catches desnudos de football dejan de enmascarar
cualquier error como conflicto de unicidad."
```
