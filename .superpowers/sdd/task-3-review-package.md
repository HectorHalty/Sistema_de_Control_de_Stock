# Review package - Task 3

Range: cd23f97..39ea2c6

## Commits

```
39ea2c6 feat(api): traducir errores Prisma a c├│digos HTTP
```

## Diff stat

```
 apps/api/src/common/prisma-errors.ts               |  19 +++-
 apps/api/src/common/prisma-exception.filter.ts     |  53 +++++++++++
 apps/api/src/football/football.service.ts          |  15 ++-
 apps/api/src/main.ts                               |   2 +
 apps/api/src/sales/sales.service.ts                |   5 +-
 apps/api/test/unit/prisma-errors.test.ts           |  31 +++++++
 apps/api/test/unit/prisma-exception.filter.test.ts | 101 +++++++++++++++++++++
 7 files changed, 217 insertions(+), 9 deletions(-)
```

## Full diff (-U10)

```diff
diff --git a/apps/api/src/common/prisma-errors.ts b/apps/api/src/common/prisma-errors.ts
index 7f02643..01565c8 100644
--- a/apps/api/src/common/prisma-errors.ts
+++ b/apps/api/src/common/prisma-errors.ts
@@ -1,3 +1,20 @@
+function prismaCode(e: unknown): string | undefined {
+  if (typeof e !== 'object' || e === null) return undefined;
+  const code = (e as { code?: unknown }).code;
+  return typeof code === 'string' ? code : undefined;
+}
+
+/** P2002 ΓÇö violaci├│n de una constraint ├║nica. */
 export function isPrismaUniqueConflict(e: unknown): boolean {
-  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
+  return prismaCode(e) === 'P2002';
+}
+
+/** P2003 ΓÇö violaci├│n de una clave for├ínea. */
+export function isPrismaForeignKeyViolation(e: unknown): boolean {
+  return prismaCode(e) === 'P2003';
+}
+
+/** P2025 ΓÇö la operaci├│n esperaba un registro que no existe. */
+export function isPrismaRecordNotFound(e: unknown): boolean {
+  return prismaCode(e) === 'P2025';
 }
diff --git a/apps/api/src/common/prisma-exception.filter.ts b/apps/api/src/common/prisma-exception.filter.ts
new file mode 100644
index 0000000..e8254d0
--- /dev/null
+++ b/apps/api/src/common/prisma-exception.filter.ts
@@ -0,0 +1,53 @@
+import {
+  ArgumentsHost,
+  Catch,
+  ExceptionFilter,
+  HttpStatus,
+  Logger,
+} from '@nestjs/common';
+import { Prisma } from '@prisma/client';
+import type { Response } from 'express';
+
+const STATUS_BY_CODE: Record<string, { status: number; message: string }> = {
+  P2002: {
+    status: HttpStatus.CONFLICT,
+    message: 'Ya existe un registro con esos datos.',
+  },
+  P2003: {
+    status: HttpStatus.BAD_REQUEST,
+    message: 'El registro referenciado no existe.',
+  },
+  P2025: {
+    status: HttpStatus.NOT_FOUND,
+    message: 'El registro no existe.',
+  },
+};
+
+@Catch(Prisma.PrismaClientKnownRequestError)
+export class PrismaExceptionFilter implements ExceptionFilter {
+  private readonly logger = new Logger(PrismaExceptionFilter.name);
+
+  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
+    const response = host.switchToHttp().getResponse<Response>();
+    const mapped = STATUS_BY_CODE[exception.code];
+
+    if (!mapped) {
+      this.logger.error(`Prisma ${exception.code}: ${exception.message}`);
+      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
+        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
+        message: 'Error interno de base de datos.',
+      });
+      return;
+    }
+
+    const target = exception.meta?.target;
+    this.logger.warn(`Prisma ${exception.code} en ${JSON.stringify(target)}`);
+
+    response.status(mapped.status).json({
+      statusCode: mapped.status,
+      message: mapped.message,
+      prismaCode: exception.code,
+      target,
+    });
+  }
+}
diff --git a/apps/api/src/football/football.service.ts b/apps/api/src/football/football.service.ts
index 1524e2c..4614599 100644
--- a/apps/api/src/football/football.service.ts
+++ b/apps/api/src/football/football.service.ts
@@ -1,16 +1,17 @@
 import {
   BadRequestException,
   ConflictException,
   Injectable,
   NotFoundException,
 } from '@nestjs/common';
+import { isPrismaUniqueConflict } from '../common/prisma-errors';
 import { PrismaService } from '../common/prisma.service';
 import { ReglamentoEngineService } from '../reglamento/reglamento-engine.service';
 import { autoScheduleMatches } from './fixture-scheduler';
 import { scheduleSaturdayMatches } from './saturday-scheduler';
 import { SuspensionSyncService } from './suspension-sync.service';
 
 @Injectable()
 export class FootballService {
   constructor(
     private prisma: PrismaService,
@@ -217,22 +218,25 @@ export class FootballService {
     try {
       return await this.prisma.equipoInscripcion.create({
         data: {
           torneoId: data.torneoId,
           equipoId,
           abbr: data.abbr ?? data.shortName,
           color: data.color,
         },
         include: { equipo: true, torneo: { include: { categoria: true } } },
       });
-    } catch {
-      throw new ConflictException('El equipo ya est├í inscripto en este torneo');
+    } catch (e) {
+      if (isPrismaUniqueConflict(e)) {
+        throw new ConflictException('El equipo ya est├í inscripto en este torneo');
+      }
+      throw e;
     }
   }
 
   async updateInscription(
     id: string,
     data: { abbr?: string; color?: string; activo?: boolean; descuentoPuntosWO?: number },
   ) {
     const existing = await this.prisma.equipoInscripcion.findUnique({ where: { id } });
     if (!existing) throw new NotFoundException(`Inscripci├│n ${id} no encontrada`);
     return this.prisma.equipoInscripcion.update({
@@ -262,22 +266,25 @@ export class FootballService {
   }) {
     const dni = data.dni.replace(/\D/g, '');
     try {
       return await this.prisma.capitanAutorizado.create({
         data: { ...data, dni, activo: true },
         include: {
           equipoInscripcion: { include: { equipo: true } },
           torneo: { include: { categoria: true } },
         },
       });
-    } catch {
-      throw new ConflictException('Email o DNI ya registrado en este torneo');
+    } catch (e) {
+      if (isPrismaUniqueConflict(e)) {
+        throw new ConflictException('Email o DNI ya registrado en este torneo');
+      }
+      throw e;
     }
   }
 
   async updateCaptain(id: string, data: { email?: string; dni?: string; activo?: boolean }) {
     const existing = await this.prisma.capitanAutorizado.findUnique({ where: { id } });
     if (!existing) throw new NotFoundException(`Capit├ín ${id} no encontrado`);
     const payload = { ...data };
     if (payload.dni) payload.dni = payload.dni.replace(/\D/g, '');
     return this.prisma.capitanAutorizado.update({
       where: { id },
diff --git a/apps/api/src/main.ts b/apps/api/src/main.ts
index 2f41d00..c8048ff 100644
--- a/apps/api/src/main.ts
+++ b/apps/api/src/main.ts
@@ -1,16 +1,17 @@
 import { NestFactory } from '@nestjs/core';
 import { ValidationPipe } from '@nestjs/common';
 import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
 import helmet from 'helmet';
 import rateLimit from 'express-rate-limit';
 import { AppModule } from './app.module';
+import { PrismaExceptionFilter } from './common/prisma-exception.filter';
 
 async function bootstrap() {
   const app = await NestFactory.create(AppModule);
   const isDev = process.env.NODE_ENV !== 'production';
 
   // Caddy sits in front in production and sets X-Forwarded-For; rate-limit needs this.
   if (!isDev) {
     app.getHttpAdapter().getInstance().set('trust proxy', 1);
   }
 
@@ -133,20 +134,21 @@ async function bootstrap() {
 
   // Global validation pipe
   app.useGlobalPipes(
     new ValidationPipe({
       whitelist: true,
       forbidNonWhitelisted: true,
       transform: true,
       transformOptions: { enableImplicitConversion: true },
     }),
   );
+  app.useGlobalFilters(new PrismaExceptionFilter());
 
   if (isDev) {
     const config = new DocumentBuilder()
       .setTitle('LCH API ΓÇö Sistema de Gesti├│n')
       .setDescription('Sistema de Gesti├│n LCH ΓÇö La Chacra F├║tbol')
       .setVersion('0.1.0')
       .addBearerAuth()
       .build();
     const document = SwaggerModule.createDocument(app, config);
     SwaggerModule.setup('api/docs', app, document);
diff --git a/apps/api/src/sales/sales.service.ts b/apps/api/src/sales/sales.service.ts
index 458e34a..b0b1874 100644
--- a/apps/api/src/sales/sales.service.ts
+++ b/apps/api/src/sales/sales.service.ts
@@ -1,14 +1,15 @@
 import {
   Injectable, NotFoundException, ConflictException, BadRequestException,
 } from '@nestjs/common';
 import { Prisma } from '@prisma/client';
+import { isPrismaUniqueConflict } from '../common/prisma-errors';
 import { PrismaService } from '../common/prisma.service';
 import { StockMovementsService } from '../stock/stock-movements.service';
 import { CheckoutDto, ReturnDto, ReturnItemsDto, UpdateTicketItemsDto } from './dto';
 import {
   aggregateSalesLineItems,
   computeReturnableFromTotals,
   round3,
 } from './sales-integrity';
 import {
   SALES_PRODUCT_API_INCLUDE,
@@ -19,24 +20,20 @@ import {
   buildRequiredByStockProduct,
   invertSaleMovements,
   loadSalesProductsForStock,
   mergeAllocations,
   parseStockAllocations,
   scaleAllocations,
   splitAllocationsToItems,
   type StockAllocation,
 } from './sales-stock';
 
-function isPrismaUniqueConflict(e: unknown): boolean {
-  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
-}
-
 interface TicketItemData extends Omit<Prisma.ItemTicketVentaUncheckedCreateWithoutTicketInput, 'createdAt'> {
   stockAllocations?: Prisma.InputJsonValue;
 }
 
 @Injectable()
 export class SalesService {
   constructor(
     private prisma: PrismaService,
     private movements: StockMovementsService,
   ) {}
diff --git a/apps/api/test/unit/prisma-errors.test.ts b/apps/api/test/unit/prisma-errors.test.ts
new file mode 100644
index 0000000..f201fde
--- /dev/null
+++ b/apps/api/test/unit/prisma-errors.test.ts
@@ -0,0 +1,31 @@
+import { describe, it, expect } from 'vitest';
+import {
+  isPrismaUniqueConflict,
+  isPrismaForeignKeyViolation,
+  isPrismaRecordNotFound,
+} from '../../src/common/prisma-errors';
+
+describe('prisma-errors', () => {
+  it('reconoce P2002 como conflicto de unicidad', () => {
+    expect(isPrismaUniqueConflict({ code: 'P2002' })).toBe(true);
+    expect(isPrismaUniqueConflict({ code: 'P2003' })).toBe(false);
+  });
+
+  it('reconoce P2003 como violaci├│n de clave for├ínea', () => {
+    expect(isPrismaForeignKeyViolation({ code: 'P2003' })).toBe(true);
+    expect(isPrismaForeignKeyViolation({ code: 'P2002' })).toBe(false);
+  });
+
+  it('reconoce P2025 como registro no encontrado', () => {
+    expect(isPrismaRecordNotFound({ code: 'P2025' })).toBe(true);
+    expect(isPrismaRecordNotFound({ code: 'P2002' })).toBe(false);
+  });
+
+  it('no explota con valores que no son objetos', () => {
+    for (const value of [null, undefined, 'P2002', 42]) {
+      expect(isPrismaUniqueConflict(value)).toBe(false);
+      expect(isPrismaForeignKeyViolation(value)).toBe(false);
+      expect(isPrismaRecordNotFound(value)).toBe(false);
+    }
+  });
+});
diff --git a/apps/api/test/unit/prisma-exception.filter.test.ts b/apps/api/test/unit/prisma-exception.filter.test.ts
new file mode 100644
index 0000000..a5b9c2a
--- /dev/null
+++ b/apps/api/test/unit/prisma-exception.filter.test.ts
@@ -0,0 +1,101 @@
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import { ArgumentsHost, HttpStatus, Logger } from '@nestjs/common';
+import { FILTER_CATCH_EXCEPTIONS } from '@nestjs/common/constants';
+import { Prisma } from '@prisma/client';
+import { PrismaExceptionFilter } from '../../src/common/prisma-exception.filter';
+
+function knownError(code: string, meta?: Record<string, unknown>) {
+  return new Prisma.PrismaClientKnownRequestError('prisma error', {
+    code,
+    clientVersion: '5.22.0',
+    meta,
+  });
+}
+
+function mockHost() {
+  const json = vi.fn();
+  const status = vi.fn().mockReturnValue({ json });
+  const host = {
+    switchToHttp: () => ({
+      getResponse: () => ({ status }),
+    }),
+  } as unknown as ArgumentsHost;
+  return { host, status, json };
+}
+
+describe('PrismaExceptionFilter', () => {
+  let warnSpy: ReturnType<typeof vi.spyOn>;
+  let errorSpy: ReturnType<typeof vi.spyOn>;
+
+  beforeEach(() => {
+    warnSpy = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
+    errorSpy = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
+  });
+
+  afterEach(() => {
+    warnSpy.mockRestore();
+    errorSpy.mockRestore();
+  });
+
+  it('expone PrismaClientKnownRequestError en el namespace Prisma en runtime', () => {
+    expect(typeof Prisma.PrismaClientKnownRequestError).toBe('function');
+    const err = knownError('P2002');
+    expect(err).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
+    expect(err.code).toBe('P2002');
+  });
+
+  it('@Catch registra PrismaClientKnownRequestError para que Nest despache el filtro', () => {
+    const caught = Reflect.getMetadata(FILTER_CATCH_EXCEPTIONS, PrismaExceptionFilter);
+    expect(caught).toEqual([Prisma.PrismaClientKnownRequestError]);
+  });
+
+  it('mapea P2002 a 409 Conflict', () => {
+    const filter = new PrismaExceptionFilter();
+    const { host, status, json } = mockHost();
+    filter.catch(knownError('P2002', { target: ['email'] }), host);
+    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
+    expect(json).toHaveBeenCalledWith({
+      statusCode: HttpStatus.CONFLICT,
+      message: 'Ya existe un registro con esos datos.',
+      prismaCode: 'P2002',
+      target: ['email'],
+    });
+  });
+
+  it('mapea P2003 a 400 Bad Request', () => {
+    const filter = new PrismaExceptionFilter();
+    const { host, status, json } = mockHost();
+    filter.catch(knownError('P2003', { target: ['equipoId'] }), host);
+    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
+    expect(json).toHaveBeenCalledWith({
+      statusCode: HttpStatus.BAD_REQUEST,
+      message: 'El registro referenciado no existe.',
+      prismaCode: 'P2003',
+      target: ['equipoId'],
+    });
+  });
+
+  it('mapea P2025 a 404 Not Found', () => {
+    const filter = new PrismaExceptionFilter();
+    const { host, status, json } = mockHost();
+    filter.catch(knownError('P2025'), host);
+    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
+    expect(json).toHaveBeenCalledWith({
+      statusCode: HttpStatus.NOT_FOUND,
+      message: 'El registro no existe.',
+      prismaCode: 'P2025',
+      target: undefined,
+    });
+  });
+
+  it('mapea un c├│digo Prisma no contemplado a 500', () => {
+    const filter = new PrismaExceptionFilter();
+    const { host, status, json } = mockHost();
+    filter.catch(knownError('P2010'), host);
+    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
+    expect(json).toHaveBeenCalledWith({
+      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
+      message: 'Error interno de base de datos.',
+    });
+  });
+});
```
