# Sacar automatización de Fixture/Horarios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar toda la generación/asignación automática de cruces, canchas y horarios del módulo de fútbol (fixture round-robin, auto-programación de jornada, auto-programación de sábado multi-categoría, preferencias de horario), dejando solo los caminos manuales — crear jornada, crear cruce a mano elegiendo los 2 equipos, asignar cancha/hora partido por partido.

**Architecture:** Es una reducción de superficie sobre un módulo existente (`apps/api/src/football` + `apps/web-admin/src/features/futbol`), no un subsistema nuevo. Se borran 3 archivos de algoritmos (round-robin, scheduler de jornada, scheduler de sábado) y los métodos/endpoints que los exponían; se agrega una única pantalla nueva —que hoy no existe en ninguna parte— para crear un cruce a mano, usando un endpoint (`POST /football/matches`) que ya existe pero que ninguna pantalla llama todavía.

**Tech Stack:** NestJS + Prisma en `apps/api`; React + Vite + Tailwind en `apps/web-admin`; Vitest para tests.

**Spec:** No hay spec escrita — es un cambio de alcance acotado (bounded), diseñado en la conversación de brainstorming del 2026-09-14. Diseño acordado: sacar automatización de cruces (round-robin) y de cancha/horario (auto-programación de jornada y de sábado multi-categoría) y su tabla de preferencias de horario (que solo existía para alimentar el auto-programador); mantener intacto el flujo de suspensión por lluvia (crea/reusa recuperación automáticamente, no es lo que se pidió sacar); agregar una pantalla de alta manual de cruce dentro del panel Fixture, por jornada.

## Global Constraints

- No tocar el flujo de suspensión por lluvia (`suspendJornadaPorLluvia`, `suspendMatch`, `suspendSaturday`) — se mantiene igual.
- No tocar la asignación manual de cancha/hora ya existente (`updateMatchSchedule` / `PUT /football/matches/:id/schedule`, usado por `FixturePanel` y por `HorariosCanchasPanel`) — se mantiene igual.
- No tocar `HorariosCanchasPanel.tsx` — ya es 100% manual, no usa ningún algoritmo de auto-programación.
- La tabla de preferencias de horario por equipo se elimina por completo (backend y frontend) — no se deja como referencia de solo lectura.
- El nuevo alta manual de cruce vive dentro del panel Fixture, por jornada: elegís equipo local y visitante entre los inscriptos en el torneo de esa jornada.
- Orden de ejecución obligatorio: Tarea 1 → Tarea 2 → Tarea 3 → Tarea 4 → Tarea 5 (cada una deja el código en un estado compilable para la siguiente; no saltear el orden).

---

## Task 1: Backend — sacar los métodos de automatización de `FootballService`

**Files:**
- Modify: `apps/api/src/football/football.service.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `FootballService` sin `getJornadaPreferencias`, `upsertJornadaPreferencia`, `generateRoundRobin`, `generateFullSeasonFixture`, `autoScheduleJornada`, `autoScheduleSaturday`, `publishJornadasByFecha` — la Tarea 2 depende de que estos métodos ya no existan para poder borrar los endpoints que los llaman sin dejar referencias rotas. La Tarea 3 depende de que este archivo ya no importe `fixture-generator.service.ts`/`fixture-scheduler.ts`/`saturday-scheduler.ts` para poder borrarlos sin dejar imports rotos.

- [ ] **Step 1: Quitar los imports de los 3 archivos que se van a borrar en la Tarea 3**

En `apps/api/src/football/football.service.ts`, las líneas 1-15 hoy son:

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPartido, TipoEventoPartido } from '@prisma/client';
import { isPrismaUniqueConflict } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import { ReglamentoEngineService } from '../reglamento/reglamento-engine.service';
import { autoScheduleMatches } from './fixture-scheduler';
import { buildRoundPairs, createMatchesForPairs, FixtureGeneratorService } from './fixture-generator.service';
import { MatchSuspensionService } from './match-suspension.service';
import { scheduleSaturdayMatches } from './saturday-scheduler';
import { SuspensionSyncService } from './suspension-sync.service';
```

Reemplazarlas por:

```typescript
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EstadoPartido, TipoEventoPartido } from '@prisma/client';
import { isPrismaUniqueConflict } from '../common/prisma-errors';
import { PrismaService } from '../common/prisma.service';
import { ReglamentoEngineService } from '../reglamento/reglamento-engine.service';
import { MatchSuspensionService } from './match-suspension.service';
import { SuspensionSyncService } from './suspension-sync.service';
```

- [ ] **Step 2: Quitar `fixtureGenerator` del constructor**

En el mismo archivo, el constructor hoy es:

```typescript
  constructor(
    private prisma: PrismaService,
    private reglamentoEngine: ReglamentoEngineService,
    private suspensionSync: SuspensionSyncService,
    private fixtureGenerator: FixtureGeneratorService,
    private matchSuspension: MatchSuspensionService,
  ) {}
```

Reemplazarlo por:

```typescript
  constructor(
    private prisma: PrismaService,
    private reglamentoEngine: ReglamentoEngineService,
    private suspensionSync: SuspensionSyncService,
    private matchSuspension: MatchSuspensionService,
  ) {}
```

- [ ] **Step 3: Borrar `getJornadaPreferencias` y `upsertJornadaPreferencia`**

Buscar y borrar este bloque completo (queda entre `createJornada` y `generateRoundRobin`):

```typescript
  async getJornadaPreferencias(jornadaId: string) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id: jornadaId },
      include: {
        torneo: { include: { categoria: { include: { grupoCanchas: true } } } },
      },
    });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');

    const grupoId = jornada.torneo.categoria.grupoCanchasId;
    const [inscripciones, preferencias, franjas] = await Promise.all([
      this.prisma.equipoInscripcion.findMany({
        where: { torneoId: jornada.torneoId, activo: true },
        include: { equipo: true },
        orderBy: { equipo: { name: 'asc' } },
      }),
      this.prisma.preferenciaHorario.findMany({ where: { jornadaId } }),
      grupoId
        ? this.prisma.franjaHoraria.findMany({
            where: { grupoCanchasId: grupoId },
            orderBy: { orden: 'asc' },
          })
        : Promise.resolve([]),
    ]);

    const prefByTeam = new Map(preferencias.map((p) => [p.equipoInscripcionId, p.horaPreferida]));

    return {
      jornadaId,
      franjas: franjas.map((f) => f.horaInicio),
      equipos: inscripciones.map((i) => ({
        inscripcionId: i.id,
        name: i.equipo.name,
        horaPreferida: prefByTeam.get(i.id) ?? null,
      })),
    };
  }

  async upsertJornadaPreferencia(
    jornadaId: string,
    equipoInscripcionId: string,
    horaPreferida: string | null,
  ) {
    const jornada = await this.prisma.jornada.findUnique({ where: { id: jornadaId } });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');

    const inscripcion = await this.prisma.equipoInscripcion.findFirst({
      where: { id: equipoInscripcionId, torneoId: jornada.torneoId, activo: true },
    });
    if (!inscripcion) throw new BadRequestException('Equipo no inscripto en este torneo');

    if (!horaPreferida) {
      await this.prisma.preferenciaHorario.deleteMany({
        where: { jornadaId, equipoInscripcionId },
      });
      return { equipoInscripcionId, horaPreferida: null };
    }

    const row = await this.prisma.preferenciaHorario.upsert({
      where: {
        jornadaId_equipoInscripcionId: { jornadaId, equipoInscripcionId },
      },
      create: {
        jornadaId,
        equipoInscripcionId,
        torneoId: jornada.torneoId,
        horaPreferida,
      },
      update: { horaPreferida },
    });

    return { equipoInscripcionId: row.equipoInscripcionId, horaPreferida: row.horaPreferida };
  }

```

- [ ] **Step 4: Borrar `generateRoundRobin` y `generateFullSeasonFixture`**

Borrar este bloque completo (queda justo antes del comentario `// Matches`):

```typescript
  async generateRoundRobin(jornadaId: string) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id: jornadaId },
      include: { torneo: true },
    });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');

    const inscripciones = await this.prisma.equipoInscripcion.findMany({
      where: { torneoId: jornada.torneoId, activo: true },
      include: { equipo: true },
    });
    if (inscripciones.length < 2) {
      throw new BadRequestException('Se necesitan al menos 2 equipos inscriptos');
    }

    const existing = await this.prisma.partidoFutbol.count({ where: { jornadaId } });
    if (existing > 0) {
      throw new ConflictException('La jornada ya tiene partidos cargados');
    }

    const roundIndex = Math.max(0, jornada.numero - 1);
    const { pairs, byeInscripcionId } = buildRoundPairs(inscripciones, roundIndex);
    const matchDate = new Date(jornada.fecha);

    const created = await createMatchesForPairs(
      this.prisma,
      { torneoId: jornada.torneoId, jornadaId: jornada.id, date: matchDate, pairs },
      this.matchInclude(),
    );

    await this.prisma.jornada.update({
      where: { id: jornadaId },
      data: { equipoLibreId: byeInscripcionId },
    });

    return { jornadaId, created: created.length, matches: created };
  }

  async generateFullSeasonFixture(torneoId: string, fechas: number, fechaInicio: string) {
    return this.fixtureGenerator.generateFullSeason(torneoId, fechas, fechaInicio);
  }

```

- [ ] **Step 5: Borrar `autoScheduleJornada`**

Borrar este bloque completo (queda justo después de `createMatch` y antes de `private dayRange`):

```typescript
  async autoScheduleJornada(jornadaId: string) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id: jornadaId },
      include: {
        torneo: { include: { categoria: { include: { grupoCanchas: true } } } },
      },
    });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada.suspendida) {
      throw new BadRequestException('No se puede programar una jornada suspendida');
    }

    const grupoId = jornada.torneo.categoria.grupoCanchasId;
    if (!grupoId) {
      throw new BadRequestException('La categoría no tiene grupo de canchas configurado');
    }

    const [canchas, franjas, matches, sameDayMatches, preferencias, inscripciones] =
      await Promise.all([
      this.prisma.cancha.findMany({
        where: { grupoCanchasId: grupoId, activa: true },
        orderBy: { numero: 'asc' },
      }),
      this.prisma.franjaHoraria.findMany({
        where: { grupoCanchasId: grupoId },
        orderBy: { orden: 'asc' },
      }),
      this.prisma.partidoFutbol.findMany({
        where: { jornadaId, status: 'pendiente' },
      }),
      this.prisma.partidoFutbol.findMany({
        where: {
          date: {
            gte: new Date(jornada.fecha.toISOString().slice(0, 10)),
            lt: new Date(
              new Date(jornada.fecha.toISOString().slice(0, 10)).getTime() + 86_400_000,
            ),
          },
          canchaId: { not: null },
          horaInicio: { not: null },
        },
      }),
      this.prisma.preferenciaHorario.findMany({ where: { jornadaId } }),
      this.prisma.equipoInscripcion.findMany({
        where: { torneoId: jornada.torneoId, activo: true },
        include: { equipo: true },
      }),
    ]);

    const slots = franjas.flatMap((f) =>
      canchas.map((c) => ({
        canchaId: c.id,
        canchaNumero: c.numero,
        horaInicio: f.horaInicio,
      })),
    );

    const canchaOccupied = new Set<string>();
    const teamOccupied = new Set<string>();
    for (const m of sameDayMatches) {
      if (m.jornadaId === jornadaId && !m.canchaId) continue;
      if (m.canchaId && m.horaInicio) {
        canchaOccupied.add(`${m.canchaId}|${m.horaInicio}`);
      }
      if (m.horaInicio) {
        if (m.homeInscripcionId) teamOccupied.add(`${m.homeInscripcionId}|${m.horaInicio}`);
        if (m.awayInscripcionId) teamOccupied.add(`${m.awayInscripcionId}|${m.horaInicio}`);
      }
    }

    const preferences: Record<string, string> = {};
    for (const p of preferencias) {
      preferences[p.equipoInscripcionId] = p.horaPreferida;
    }

    const teamNames: Record<string, string> = {};
    for (const ins of inscripciones) {
      teamNames[ins.id] = ins.equipo.name;
    }

    const result = autoScheduleMatches(
      matches.map((m) => ({
        id: m.id,
        homeInscripcionId: m.homeInscripcionId,
        awayInscripcionId: m.awayInscripcionId,
        bloqueadoManual: m.bloqueadoManual,
        canchaId: m.canchaId,
        horaInicio: m.horaInicio,
      })),
      slots,
      canchaOccupied,
      teamOccupied,
      preferences,
      teamNames,
    );

    for (const assignment of result.assignments) {
      await this.prisma.partidoFutbol.update({
        where: { id: assignment.matchId },
        data: {
          canchaId: assignment.canchaId,
          horaInicio: assignment.horaInicio,
          venue: assignment.venue,
        },
      });
    }

    return {
      jornadaId,
      scheduled: result.assignments.length,
      warnings: result.warnings,
      skippedManual: result.skipped.length,
    };
  }

```

- [ ] **Step 6: Borrar `autoScheduleSaturday`**

Borrar este bloque completo (queda entre `getSaturdayGrid` y `publishJornadasByFecha`):

```typescript
  async autoScheduleSaturday(
    fecha: string,
    campeonatoId?: string,
    categoriaOrder?: string[],
  ) {
    const { dayStart, dayEnd } = this.dayRange(fecha);
    const campeonato = campeonatoId
      ? await this.prisma.campeonato.findUnique({ where: { id: campeonatoId } })
      : await this.prisma.campeonato.findFirst({ where: { activo: true } });
    if (!campeonato) throw new BadRequestException('No hay campeonato activo');

    const torneos = await this.prisma.torneo.findMany({
      where: { campeonatoId: campeonato.id, activo: true },
      include: { categoria: { include: { grupoCanchas: true } } },
    });
    if (!torneos.length) throw new BadRequestException('No hay torneos activos en el campeonato');

    const torneoIds = torneos.map((t) => t.id);
    const defaultOrder = torneos.map((t) => t.categoria.codigo).sort();
    const order = categoriaOrder?.length ? categoriaOrder : defaultOrder;

    const [canchas, franjas, jornadas, inscripciones] = await Promise.all([
      this.prisma.cancha.findMany({
        where: { activa: true },
        include: { grupoCanchas: true },
        orderBy: { numero: 'asc' },
      }),
      this.prisma.franjaHoraria.findMany({ orderBy: [{ grupoCanchasId: 'asc' }, { orden: 'asc' }] }),
      this.prisma.jornada.findMany({
        where: {
          torneoId: { in: torneoIds },
          fecha: { gte: dayStart, lt: dayEnd },
          suspendida: false,
        },
      }),
      this.prisma.equipoInscripcion.findMany({
        where: { torneoId: { in: torneoIds }, activo: true },
        include: { equipo: true },
      }),
    ]);

    const jornadaIds = jornadas.map((j) => j.id);
    const [matches, sameDayMatches, preferencias] = await Promise.all([
      this.prisma.partidoFutbol.findMany({
        where: { jornadaId: { in: jornadaIds }, status: 'pendiente' },
      }),
      this.prisma.partidoFutbol.findMany({
        where: {
          date: { gte: dayStart, lt: dayEnd },
          canchaId: { not: null },
          horaInicio: { not: null },
        },
      }),
      this.prisma.preferenciaHorario.findMany({
        where: { jornadaId: { in: jornadaIds } },
      }),
    ]);

    const slotMap = new Map<string, { canchaId: string; canchaNumero: number; horaInicio: string }>();
    for (const f of franjas) {
      for (const c of canchas.filter((x) => x.grupoCanchasId === f.grupoCanchasId)) {
        slotMap.set(`${c.id}|${f.horaInicio}`, {
          canchaId: c.id,
          canchaNumero: c.numero,
          horaInicio: f.horaInicio,
        });
      }
    }
    const slots = [...slotMap.values()];

    const canchaOccupied = new Set<string>();
    const teamOccupied = new Set<string>();
    const schedulingJornadaIds = new Set(jornadaIds);

    for (const m of sameDayMatches) {
      if (m.jornadaId && schedulingJornadaIds.has(m.jornadaId) && !m.canchaId) continue;
      if (m.canchaId && m.horaInicio) canchaOccupied.add(`${m.canchaId}|${m.horaInicio}`);
      if (m.horaInicio) {
        if (m.homeInscripcionId) teamOccupied.add(`${m.homeInscripcionId}|${m.horaInicio}`);
        if (m.awayInscripcionId) teamOccupied.add(`${m.awayInscripcionId}|${m.horaInicio}`);
      }
    }

    const preferences: Record<string, string> = {};
    for (const p of preferencias) preferences[p.equipoInscripcionId] = p.horaPreferida;

    const teamNames: Record<string, string> = {};
    for (const ins of inscripciones) teamNames[ins.id] = ins.equipo.name;

    const torneoMap = new Map(torneos.map((t) => [t.id, t]));

    const saturdayMatches = matches.map((m) => {
      const torneo = torneoMap.get(m.torneoId!);
      const grupoId = torneo!.categoria.grupoCanchasId!;
      return {
        id: m.id,
        torneoId: m.torneoId!,
        homeInscripcionId: m.homeInscripcionId,
        awayInscripcionId: m.awayInscripcionId,
        bloqueadoManual: m.bloqueadoManual,
        canchaId: m.canchaId,
        horaInicio: m.horaInicio,
        categoriaCodigo: torneo!.categoria.codigo,
        categoriaNombre: torneo!.categoria.nombre,
        categoriaColor: torneo!.categoria.colorHex,
        grupoCodigo: torneo!.categoria.grupoCanchas?.codigo ?? '',
        allowedCanchaIds: new Set(
          canchas.filter((c) => c.grupoCanchasId === grupoId).map((c) => c.id),
        ),
        allowedHoras: new Set(
          franjas.filter((f) => f.grupoCanchasId === grupoId).map((f) => f.horaInicio),
        ),
      };
    });

    const result = scheduleSaturdayMatches({
      matches: saturdayMatches,
      slots,
      preferences,
      teamNames,
      categoriaOrder: order,
      existingCanchaOccupied: canchaOccupied,
      existingTeamOccupied: teamOccupied,
    });

    for (const assignment of result.assignments) {
      await this.prisma.partidoFutbol.update({
        where: { id: assignment.matchId },
        data: {
          canchaId: assignment.canchaId,
          horaInicio: assignment.horaInicio,
          venue: assignment.venue,
        },
      });
    }

    return {
      fecha,
      campeonatoId: campeonato.id,
      scheduled: result.assignments.length,
      skippedManual: result.skipped.length,
      unassigned: result.unassigned.length,
      warnings: result.warnings,
    };
  }

```

- [ ] **Step 7: Borrar `publishJornadasByFecha`**

Borrar este bloque completo (queda entre `autoScheduleSaturday` y `suspendJornadaPorLluvia`):

```typescript
  async publishJornadasByFecha(fecha: string, campeonatoId?: string) {
    const { dayStart, dayEnd } = this.dayRange(fecha);
    const campeonato = campeonatoId
      ? await this.prisma.campeonato.findUnique({ where: { id: campeonatoId } })
      : await this.prisma.campeonato.findFirst({ where: { activo: true } });
    if (!campeonato) throw new BadRequestException('No hay campeonato activo');

    const torneoIds = (
      await this.prisma.torneo.findMany({
        where: { campeonatoId: campeonato.id, activo: true },
        select: { id: true },
      })
    ).map((t) => t.id);

    const updated = await this.prisma.jornada.updateMany({
      where: {
        torneoId: { in: torneoIds },
        fecha: { gte: dayStart, lt: dayEnd },
        suspendida: false,
      },
      data: { publicada: true },
    });

    await this.prisma.torneo.updateMany({
      where: { id: { in: torneoIds } },
      data: { publicado: true },
    });

    return { fecha, publicadas: updated.count };
  }

```

Nota: `dayRange` (el método privado justo antes de `getSaturdayGrid`) **NO se borra** — lo sigue usando `getSaturdayGrid`, que se mantiene.

- [ ] **Step 8: Verificar que la API compila**

Run: `cd apps/api && npm run build`
Expected: falla en este punto porque `football.controller.ts` (Tarea 2, todavía no hecha) sigue llamando a métodos borrados. **Es esperado** — el único error debe ser "Property 'generateRoundRobin'/'generateFullSeasonFixture'/'autoScheduleJornada'/'autoScheduleSaturday'/'getJornadaPreferencias'/'upsertJornadaPreferencia'/'publishJornadasByFecha' does not exist on type 'FootballService'" (o equivalente); si hay algún otro error (import colgado, variable sin usar dentro del propio `football.service.ts`), corregirlo antes de seguir.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/football/football.service.ts
git commit -m "chore(api): sacar metodos de auto-fixture y auto-programacion de FootballService"
```

---

## Task 2: Backend — sacar los endpoints de automatización del controller y el DTO ahora sin uso

**Files:**
- Modify: `apps/api/src/football/football.controller.ts`
- Modify: `apps/api/src/football/dto.ts`

**Interfaces:**
- Consumes: nada (a esta altura `FootballService`, Tarea 1 completa, ya no tiene los métodos de automatización).
- Produces: `FootballController` sin las rutas de automatización — el build de la API vuelve a estar limpio con esto (la Tarea 1 lo dejó roto a propósito).

- [ ] **Step 1: Borrar los 7 endpoints de automatización**

En `apps/api/src/football/football.controller.ts`, borrar estos 3 bloques completos:

```typescript
  @Post('scheduling/auto-saturday')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  autoScheduleSaturday(
    @Body() body: { fecha: string; campeonatoId?: string; categoriaOrder?: string[] },
  ) {
    return this.footballService.autoScheduleSaturday(
      body.fecha,
      body.campeonatoId,
      body.categoriaOrder,
    );
  }

  @Post('scheduling/publish-fecha')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  publishJornadasByFecha(@Body() body: { fecha: string; campeonatoId?: string }) {
    return this.footballService.publishJornadasByFecha(body.fecha, body.campeonatoId);
  }

```

(este bloque queda entre `getSaturdayGrid` y `listCategorias` — al borrarlo, `getSaturdayGrid` queda pegado a `listCategorias`)

```typescript
  @Post('jornadas/:id/round-robin')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  generateRoundRobin(@Param('id') id: string) {
    return this.footballService.generateRoundRobin(id);
  }

  @Post('torneos/:id/generate-fixture')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  generateFixture(@Param('id') id: string, @Body() body: GenerateFixtureDto) {
    return this.footballService.generateFullSeasonFixture(id, body.fechas, body.fechaInicio);
  }

  @Post('jornadas/:id/auto-schedule')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  autoScheduleJornada(@Param('id') id: string) {
    return this.footballService.autoScheduleJornada(id);
  }

```

(este bloque queda entre `createJornada` y `suspendJornadaPorLluvia` — al borrarlo, `createJornada` queda pegado a `suspendJornadaPorLluvia`)

```typescript
  @Get('jornadas/:id/preferencias')
  @Roles(...FOOTBALL_READ_ROLES)
  getJornadaPreferencias(@Param('id') id: string) {
    return this.footballService.getJornadaPreferencias(id);
  }

  @Put('jornadas/:id/preferencias/:inscripcionId')
  @Roles(...FOOTBALL_MUTATION_ROLES)
  upsertJornadaPreferencia(
    @Param('id') id: string,
    @Param('inscripcionId') inscripcionId: string,
    @Body() body: { horaPreferida: string | null },
  ) {
    return this.footballService.upsertJornadaPreferencia(
      id,
      inscripcionId,
      body.horaPreferida,
    );
  }

```

(este bloque queda entre `publishJornada` y `findAllMatches` — al borrarlo, `publishJornada` queda pegado a `findAllMatches`)

- [ ] **Step 2: Quitar `GenerateFixtureDto` del import de `dto.ts`**

En `apps/api/src/football/football.controller.ts`, el import de `./dto` hoy es:

```typescript
import {
  CreateCategoriaDto,
  GenerateFixtureDto,
  SuspendMatchDto,
  SuspendSaturdayDto,
  UpdateCaptainDto,
  UpdateCategoriaDto,
  UpdateInscriptionDto,
  UpdateMatchScheduleDto,
  UpdateMatchScoreDto,
  UpdateReglamentoArticuloDto,
  UpdateSuspensionDto,
} from './dto';
```

Reemplazarlo por (se quita `GenerateFixtureDto`):

```typescript
import {
  CreateCategoriaDto,
  SuspendMatchDto,
  SuspendSaturdayDto,
  UpdateCaptainDto,
  UpdateCategoriaDto,
  UpdateInscriptionDto,
  UpdateMatchScheduleDto,
  UpdateMatchScoreDto,
  UpdateReglamentoArticuloDto,
  UpdateSuspensionDto,
} from './dto';
```

- [ ] **Step 3: Borrar `GenerateFixtureDto` de `dto.ts`**

En `apps/api/src/football/dto.ts`, borrar este bloque:

```typescript
export class GenerateFixtureDto {
  @IsInt()
  @IsPositive()
  fechas: number;

  @IsDateString()
  fechaInicio: string;
}

```

Y quitar `IsPositive` del import de `class-validator` en la primera línea del archivo — hoy es:

```typescript
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { GeneroCategoria, TipoEventoPartido } from '@prisma/client';
```

Reemplazarlo por (se quita `IsPositive` — `IsDateString` sigue haciendo falta para `SuspendSaturdayDto`):

```typescript
import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';
import { GeneroCategoria, TipoEventoPartido } from '@prisma/client';
```

- [ ] **Step 4: Verificar que la API compila**

Run: `cd apps/api && npm run build`
Expected: build limpio, sin errores.

- [ ] **Step 5: Correr los tests de la API**

Run: `cd apps/api && npx vitest run`
Expected: mismos resultados que antes de este cambio (si había una falla preexistente no relacionada, sigue igual; no debe haber fallas nuevas).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/football/football.controller.ts apps/api/src/football/dto.ts
git commit -m "chore(api): sacar endpoints de auto-fixture y auto-programacion de FootballController"
```

---

## Task 3: Backend — borrar los 3 archivos de algoritmos de automatización y sus tests

**Files:**
- Delete: `apps/api/src/football/fixture-generator.service.ts`
- Delete: `apps/api/src/football/fixture-scheduler.ts`
- Delete: `apps/api/src/football/saturday-scheduler.ts`
- Delete: `apps/api/test/fixture-scheduler.test.ts`
- Delete: `apps/api/test/saturday-scheduler.test.ts`
- Modify: `apps/api/src/football/football.module.ts`

**Interfaces:**
- Consumes: nada (la Tarea 1 ya quitó todos los imports de estos 3 archivos).
- Produces: nada — deja de existir código muerto.

- [ ] **Step 1: Verificar que nada más importa estos 3 archivos**

Run: `cd apps/api && grep -rn "fixture-generator\|fixture-scheduler\|saturday-scheduler" src test --include=*.ts`
Expected: sin resultados. Si aparece algo, revisar que la Tarea 1 se aplicó completa antes de seguir.

- [ ] **Step 2: Borrar los archivos**

```bash
cd apps/api
rm src/football/fixture-generator.service.ts
rm src/football/fixture-scheduler.ts
rm src/football/saturday-scheduler.ts
rm test/fixture-scheduler.test.ts
rm test/saturday-scheduler.test.ts
```

- [ ] **Step 3: Quitar `FixtureGeneratorService` de `football.module.ts`**

En `apps/api/src/football/football.module.ts`, el archivo completo hoy es:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReglamentoModule } from '../reglamento/reglamento.module';
import { PrismaService } from '../common/prisma.service';
import { FootballService } from './football.service';
import { FootballController } from './football.controller';
import { FixtureGeneratorService } from './fixture-generator.service';
import { MatchSuspensionService } from './match-suspension.service';
import { SuspensionSyncService } from './suspension-sync.service';

@Module({
  imports: [AuthModule, ReglamentoModule],
  providers: [
    FootballService,
    SuspensionSyncService,
    FixtureGeneratorService,
    MatchSuspensionService,
    PrismaService,
  ],
  controllers: [FootballController],
  exports: [FootballService],
})
export class FootballModule {}
```

Reemplazarlo por:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ReglamentoModule } from '../reglamento/reglamento.module';
import { PrismaService } from '../common/prisma.service';
import { FootballService } from './football.service';
import { FootballController } from './football.controller';
import { MatchSuspensionService } from './match-suspension.service';
import { SuspensionSyncService } from './suspension-sync.service';

@Module({
  imports: [AuthModule, ReglamentoModule],
  providers: [
    FootballService,
    SuspensionSyncService,
    MatchSuspensionService,
    PrismaService,
  ],
  controllers: [FootballController],
  exports: [FootballService],
})
export class FootballModule {}
```

- [ ] **Step 4: Verificar que la API compila**

Run: `cd apps/api && npm run build`
Expected: build limpio, sin errores.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/football/football.module.ts
git rm apps/api/src/football/fixture-generator.service.ts apps/api/src/football/fixture-scheduler.ts apps/api/src/football/saturday-scheduler.ts apps/api/test/fixture-scheduler.test.ts apps/api/test/saturday-scheduler.test.ts
git commit -m "chore(api): borrar algoritmos de auto-fixture y auto-programacion de canchas/horarios"
```

---

## Task 4: Web-admin — sacar los métodos y tipos de automatización del cliente API

**Files:**
- Modify: `apps/web-admin/src/app/api/client.ts`

**Interfaces:**
- Consumes: nada (los endpoints ya no existen del lado de la API tras la Tarea 2).
- Produces: `footballApi` sin `generateFixture`, `jornadas.roundRobin`, `jornadas.autoSchedule`, `jornadas.preferencias`, `scheduling.autoSaturday`, `scheduling.publishFecha`, y sin el tipo `FootballJornadaPreferencias` — la Tarea 5 (FixturePanel) depende de que estos ya no existan para no dejar imports rotos.

- [ ] **Step 1: Borrar `generateFixture` de `footballApi`**

En `apps/web-admin/src/app/api/client.ts`, borrar este bloque (queda entre `updateTorneo` y `canchas`):

```typescript
  generateFixture: (
    torneoId: string,
    data: { fechas: number; fechaInicio: string },
    token: string,
  ) =>
    apiFetch<{ torneoId: string; jornadasCreadas: number; jornadas: FootballJornada[] }>(
      `/football/torneos/${torneoId}/generate-fixture`,
      { method: 'POST', token, body: data },
    ),
```

- [ ] **Step 2: Borrar `roundRobin`, `autoSchedule` y `preferencias` de `footballApi.jornadas`**

En el mismo archivo, dentro de `jornadas: { ... }`, el bloque hoy es:

```typescript
  jornadas: {
    list: (token: string, torneoId?: string) => {
      const q = torneoId ? `?torneoId=${torneoId}` : '';
      return apiFetch<FootballJornada[]>(`/football/jornadas${q}`, { token });
    },
    create: (data: { torneoId: string; numero: number; fecha: string }, token: string) =>
      apiFetch<FootballJornada>('/football/jornadas', { method: 'POST', token, body: data }),
    roundRobin: (jornadaId: string, token: string) =>
      apiFetch<{ created: number; matches: FootballMatch[] }>(
        `/football/jornadas/${jornadaId}/round-robin`,
        { method: 'POST', token },
      ),
    autoSchedule: (jornadaId: string, token: string) =>
      apiFetch<{ scheduled: number; warnings: string[]; skippedManual: number }>(
        `/football/jornadas/${jornadaId}/auto-schedule`,
        { method: 'POST', token },
      ),
    suspendRain: (jornadaId: string, token: string) =>
      apiFetch<{
        recoveryJornadaId: string;
        recoveryNumero: number;
        movedMatches: number;
      }>(`/football/jornadas/${jornadaId}/suspend-rain`, { method: 'POST', token }),
    publish: (jornadaId: string, token: string) =>
      apiFetch<{ jornadaId: string; publicada: boolean }>(
        `/football/jornadas/${jornadaId}/publish`,
        { method: 'POST', token },
      ),
    preferencias: {
      get: (jornadaId: string, token: string) =>
        apiFetch<FootballJornadaPreferencias>(`/football/jornadas/${jornadaId}/preferencias`, {
          token,
        }),
      upsert: (
        jornadaId: string,
        inscripcionId: string,
        horaPreferida: string | null,
        token: string,
      ) =>
        apiFetch<{ equipoInscripcionId: string; horaPreferida: string | null }>(
          `/football/jornadas/${jornadaId}/preferencias/${inscripcionId}`,
          { method: 'PUT', token, body: { horaPreferida } },
        ),
    },
  },
```

Reemplazarlo por (queda solo `list`, `create`, `suspendRain`, `publish`):

```typescript
  jornadas: {
    list: (token: string, torneoId?: string) => {
      const q = torneoId ? `?torneoId=${torneoId}` : '';
      return apiFetch<FootballJornada[]>(`/football/jornadas${q}`, { token });
    },
    create: (data: { torneoId: string; numero: number; fecha: string }, token: string) =>
      apiFetch<FootballJornada>('/football/jornadas', { method: 'POST', token, body: data }),
    suspendRain: (jornadaId: string, token: string) =>
      apiFetch<{
        recoveryJornadaId: string;
        recoveryNumero: number;
        movedMatches: number;
      }>(`/football/jornadas/${jornadaId}/suspend-rain`, { method: 'POST', token }),
    publish: (jornadaId: string, token: string) =>
      apiFetch<{ jornadaId: string; publicada: boolean }>(
        `/football/jornadas/${jornadaId}/publish`,
        { method: 'POST', token },
      ),
  },
```

- [ ] **Step 3: Borrar `autoSaturday` y `publishFecha` de `footballApi.scheduling`**

En el mismo archivo, dentro de `scheduling: { ... }`, borrar estos dos bloques (quedan entre `saturdayGrid` y `suspendSaturday`):

```typescript
    autoSaturday: (
      token: string,
      data: { fecha: string; campeonatoId?: string; categoriaOrder?: string[] },
    ) =>
      apiFetch<{
        fecha: string;
        scheduled: number;
        skippedManual: number;
        unassigned: number;
        warnings: string[];
      }>('/football/scheduling/auto-saturday', { method: 'POST', token, body: data }),
    publishFecha: (token: string, data: { fecha: string; campeonatoId?: string }) =>
      apiFetch<{ fecha: string; publicadas: number }>(
        '/football/scheduling/publish-fecha',
        { method: 'POST', token, body: data },
      ),
```

- [ ] **Step 4: Borrar el tipo `FootballJornadaPreferencias`**

Borrar este bloque:

```typescript
export interface FootballJornadaPreferencias {
  jornadaId: string;
  franjas: string[];
  equipos: { inscripcionId: string; name: string; horaPreferida: string | null }[];
}

```

- [ ] **Step 5: Build (esperado que falle en este punto)**

Run: `cd apps/web-admin && npm run build`
Expected: falla porque `FixturePanel.tsx` (Tarea 5, todavía no hecha) sigue llamando a `footballApi.generateFixture`, `jornadas.roundRobin`, etc. **Es esperado** — se resuelve en la Tarea 5. Confirmar que el único error de build es justamente ese (propiedades inexistentes en `footballApi` dentro de `FixturePanel.tsx`), no otro.

- [ ] **Step 6: Commit**

```bash
git add apps/web-admin/src/app/api/client.ts
git commit -m "chore(web-admin): sacar cliente de auto-fixture y auto-programacion"
```

---

## Task 5: Web-admin — reescribir `FixturePanel.tsx` sin automatización + alta manual de cruce

**Files:**
- Modify: `apps/web-admin/src/features/futbol/panels/FixturePanel.tsx` (reescritura completa)
- Delete: `apps/web-admin/src/features/futbol/panels/SaturdayGridPreview.tsx`

**Interfaces:**
- Consumes: `footballApi.matches.create(data, token)` (ya existe, sin cambios — `data: { homeTeamId, awayTeamId, date, venue?, torneoId?, jornadaId?, homeInscripcionId?, awayInscripcionId?, canchaId?, horaInicio? }`), `footballApi.jornadas.{list,create,suspendRain,publish}`, `footballApi.matches.{list,updateSchedule}`, `footballApi.canchas`, `footballApi.inscriptions.list` — todos sin cambios de firma (Tarea 4 completa).
- Produces: nada nuevo para otras tareas — es la última tarea del plan.

- [ ] **Step 1: Borrar `SaturdayGridPreview.tsx`**

```bash
cd apps/web-admin
rm src/features/futbol/panels/SaturdayGridPreview.tsx
```

- [ ] **Step 2: Reescribir `FixturePanel.tsx` completo**

Reemplazar TODO el contenido de `apps/web-admin/src/features/futbol/panels/FixturePanel.tsx` por:

```tsx
import { useCallback, useEffect, useState } from 'react';
import {
  footballApi,
  getAccessToken,
  type FootballCancha,
  type FootballInscription,
  type FootballJornada,
  type FootballMatch,
} from '@/app/api/client';
import { ListPlus, UserPlus } from 'lucide-react';
import {
  FutbolError,
  FutbolPanelShell,
  FutbolSuccess,
  futbolButtonClass,
  futbolCardClass,
  futbolFieldClass,
  useFutbolOverview,
} from '../futbol-shared';
import { FixtureGridPreview } from './FixtureGridPreview';

export function FixturePanel() {
  const { torneoId } = useFutbolOverview();
  const [jornadas, setJornadas] = useState<FootballJornada[]>([]);
  const [matches, setMatches] = useState<FootballMatch[]>([]);
  const [canchas, setCanchas] = useState<FootballCancha[]>([]);
  const [inscripciones, setInscripciones] = useState<FootballInscription[]>([]);
  const [selectedJornada, setSelectedJornada] = useState('');
  const [numero, setNumero] = useState('1');
  const [fecha, setFecha] = useState('');
  const [homeInscripcionId, setHomeInscripcionId] = useState('');
  const [awayInscripcionId, setAwayInscripcionId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [scheduleWarnings, setScheduleWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [j, c, i] = await Promise.all([
        footballApi.jornadas.list(token, torneoId ?? undefined),
        footballApi.canchas(token),
        torneoId
          ? footballApi.inscriptions.list(token, torneoId)
          : Promise.resolve<FootballInscription[]>([]),
      ]);
      setJornadas(j);
      setCanchas(c);
      setInscripciones(i);
      const jId = selectedJornada || j[0]?.id || '';
      if (!selectedJornada && j[0]) setSelectedJornada(j[0].id);
      if (jId) {
        setMatches(await footballApi.matches.list(token, { jornadaId: jId }));
      } else {
        setMatches([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [torneoId, selectedJornada]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createJornada(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    if (!token || !torneoId || !fecha) return;
    setBusy(true);
    setSuccess(null);
    try {
      await footballApi.jornadas.create({ torneoId, numero: Number(numero), fecha }, token);
      setSuccess(`Jornada ${numero} creada.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear jornada');
    } finally {
      setBusy(false);
    }
  }

  async function createCruce(e: React.FormEvent) {
    e.preventDefault();
    const token = getAccessToken();
    const jornada = jornadas.find((j) => j.id === selectedJornada);
    const home = inscripciones.find((i) => i.id === homeInscripcionId);
    const away = inscripciones.find((i) => i.id === awayInscripcionId);
    if (!token || !jornada || !home || !away || home.id === away.id) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      await footballApi.matches.create(
        {
          homeTeamId: home.equipoId,
          awayTeamId: away.equipoId,
          date: jornada.fecha,
          torneoId: jornada.torneoId,
          jornadaId: jornada.id,
          homeInscripcionId: home.id,
          awayInscripcionId: away.id,
        },
        token,
      );
      setSuccess(`Cruce agregado: ${home.equipo.name} vs ${away.equipo.name}.`);
      setHomeInscripcionId('');
      setAwayInscripcionId('');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo agregar el cruce');
    } finally {
      setBusy(false);
    }
  }

  async function suspendRain() {
    const token = getAccessToken();
    if (!token || !selectedJornada) return;
    if (!confirm('¿Suspender esta jornada por lluvia y mover partidos a recuperación?')) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await footballApi.jornadas.suspendRain(selectedJornada, token);
      setSuccess(
        `Jornada suspendida. Recuperación #${result.recoveryNumero} — ${result.movedMatches} partido(s) movidos.`,
      );
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo suspender jornada');
    } finally {
      setBusy(false);
    }
  }

  async function publishJornada() {
    const token = getAccessToken();
    if (!token || !selectedJornada) return;
    setBusy(true);
    setSuccess(null);
    try {
      await footballApi.jornadas.publish(selectedJornada, token);
      setSuccess('Jornada publicada — visible en la web pública.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo publicar jornada');
    } finally {
      setBusy(false);
    }
  }

  const selectedJornadaData = jornadas.find((j) => j.id === selectedJornada);

  function equipoLibreNombre(jornada: FootballJornada | undefined) {
    if (!jornada?.equipoLibreId) return null;
    const insc = inscripciones.find((i) => i.id === jornada.equipoLibreId);
    return insc?.equipo?.name ?? insc?.abbr ?? null;
  }

  async function updateSchedule(matchId: string, canchaId: string, horaInicio: string) {
    const token = getAccessToken();
    if (!token || !canchaId) return;
    setError(null);
    setScheduleWarnings([]);
    try {
      const result = await footballApi.matches.updateSchedule(
        matchId,
        { canchaId, horaInicio, bloqueadoManual: true },
        token,
      );
      if (result.warnings.length) setScheduleWarnings(result.warnings);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar horario');
    }
  }

  const canCreateCruce = Boolean(
    selectedJornada && homeInscripcionId && awayInscripcionId && homeInscripcionId !== awayInscripcionId,
  );

  return (
    <FutbolPanelShell
      title="Fixture"
      subtitle="Creá jornadas, cargá los cruces a mano y asigná cancha/horario partido por partido"
    >

      {error && <FutbolError message={error} />}
      {success && <FutbolSuccess message={success} />}
      {scheduleWarnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Avisos de historial al editar manualmente:</p>
          <ul className="mt-1 list-inside list-disc">
            {scheduleWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ListPlus size={16} className="text-muted-foreground" />
          Jornadas y cruces
        </h3>

        <form onSubmit={createJornada} className="grid gap-3 md:grid-cols-4">
          <input
            className={futbolFieldClass()}
            type="number"
            min={1}
            placeholder="N° jornada"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
          />
          <input
            className={futbolFieldClass()}
            type="date"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
          />
          <button type="submit" disabled={busy || !torneoId} className={futbolButtonClass()}>
            Crear jornada
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className={futbolFieldClass('max-w-xs')}
            value={selectedJornada}
            onChange={(e) => setSelectedJornada(e.target.value)}
          >
            {jornadas.map((j) => (
              <option key={j.id} value={j.id}>
                Jornada {j.numero}
                {j.esRecuperacion ? ' (recup.)' : ''}
                {j.suspendida ? ' — SUSP.' : ''}
                {j.publicada ? ' ✓ pub.' : ''}
                — {new Date(j.fecha).toLocaleDateString('es-AR')}
                {equipoLibreNombre(j) ? ` — Libre: ${equipoLibreNombre(j)}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !selectedJornada || selectedJornadaData?.suspendida}
            onClick={() => void publishJornada()}
            className={futbolButtonClass('ghost')}
          >
            Publicar jornada
          </button>
          <button
            type="button"
            disabled={busy || !selectedJornada || selectedJornadaData?.suspendida}
            onClick={() => void suspendRain()}
            className={futbolButtonClass('ghost')}
          >
            Suspender por lluvia
          </button>
        </div>

        {selectedJornadaData?.suspendida && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            Esta jornada está suspendida.
          </div>
        )}
        {equipoLibreNombre(selectedJornadaData) && (
          <p className="text-sm text-muted-foreground">
            Libre esta fecha:{' '}
            <span className="font-medium text-foreground">{equipoLibreNombre(selectedJornadaData)}</span>
          </p>
        )}

        {selectedJornada && (
          <form onSubmit={createCruce} className="space-y-2 rounded-xl border border-border bg-muted/30 p-4">
            <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <UserPlus size={16} className="text-muted-foreground" />
              Agregar cruce a esta jornada
            </h4>
            {!inscripciones.length ? (
              <p className="text-xs text-muted-foreground">
                Inscribí al menos 2 equipos en el torneo para poder armar cruces.
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-3">
                <select
                  className={futbolFieldClass()}
                  value={homeInscripcionId}
                  onChange={(e) => setHomeInscripcionId(e.target.value)}
                >
                  <option value="">Equipo local...</option>
                  {inscripciones.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.equipo.name}
                    </option>
                  ))}
                </select>
                <select
                  className={futbolFieldClass()}
                  value={awayInscripcionId}
                  onChange={(e) => setAwayInscripcionId(e.target.value)}
                >
                  <option value="">Equipo visitante...</option>
                  {inscripciones.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.equipo.name}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={busy || !canCreateCruce || selectedJornadaData?.suspendida}
                  className={futbolButtonClass()}
                >
                  Agregar cruce
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando partidos...</p>
      ) : (
        <>
          {matches.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold">Vista grilla</h3>
              <FixtureGridPreview matches={matches} canchas={canchas} />
            </div>
          )}

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Partidos</h3>
            {matches.map((m) => (
              <div key={m.id} className={futbolCardClass('p-4')}>
                <p className="font-medium">
                  {m.homeTeam?.name} vs {m.awayTeam?.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <select
                    className={futbolFieldClass('max-w-[160px]')}
                    value={m.canchaId ?? ''}
                    onChange={(e) =>
                      void updateSchedule(m.id, e.target.value, m.horaInicio ?? '14:00')
                    }
                  >
                    <option value="">Cancha</option>
                    {canchas.map((c) => (
                      <option key={c.id} value={c.id}>
                        C{c.numero} ({c.grupoCanchas?.codigo})
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className={futbolFieldClass('max-w-[160px]')}
                    value={m.horaInicio ?? '14:00'}
                    onChange={(e) => {
                      const canchaId = m.canchaId ?? canchas[0]?.id ?? '';
                      if (canchaId) void updateSchedule(m.id, canchaId, e.target.value);
                    }}
                  />
                  <span className="self-center text-xs text-muted-foreground">
                    {m.status}
                    {m.bloqueadoManual ? ' · manual' : ''}
                  </span>
                </div>
              </div>
            ))}
            {matches.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin partidos en esta jornada.</p>
            )}
          </div>
        </>
      )}
    </FutbolPanelShell>
  );
}
```

Notas sobre este reemplazo:
- Se borraron `TorneoFixtureWizard`, `SaturdayMultiCatSection` y `PreferenciasHorarioSection` completos (y sus imports: `Calendar` de `lucide-react`, `SaturdayGridPreview`, el tipo `SaturdayGridResponse`, el tipo `FootballJornadaPreferencias`).
- La sección "Avanzado: agregar jornada suelta" dejó de estar colapsada dentro de un `<details>` — ahora es la sección principal siempre visible ("Jornadas y cruces"), porque sin automatización es el único camino para armar el fixture.
- Se agregó el formulario "Agregar cruce a esta jornada": dos `<select>` (equipo local / visitante, poblados desde `inscripciones`) + botón, que llama a `footballApi.matches.create` (endpoint ya existente, antes sin ninguna UI) con la fecha de la jornada seleccionada.
- Todo lo demás (grilla de vista `FixtureGridPreview`, lista de partidos con asignación manual de cancha/hora, publicar jornada, suspender por lluvia) queda igual que antes.

- [ ] **Step 3: Verificar que el proyecto compila**

Run: `cd apps/web-admin && npm run build`
Expected: build limpio, sin errores.

- [ ] **Step 4: Verificar manualmente en el navegador**

Run: `cd apps/web-admin && npm run dev`

Con un usuario que tenga acceso al módulo de fútbol, ir a `http://localhost:5173/#/futbol` (o donde esté montado `FixturePanel`), elegir un torneo con al menos 2 equipos inscriptos:

1. Crear una jornada nueva (número + fecha) → aparece en el selector.
2. Con esa jornada seleccionada, elegir equipo local y visitante en "Agregar cruce a esta jornada" y confirmar que el partido aparece en la lista de "Partidos" de abajo.
3. Asignar cancha y hora a ese partido desde los selects de la lista → confirmar que persiste al recargar.
4. Confirmar que NO aparece en ningún lado un botón de "Generar fixture completo", "Generar cruces (round-robin)", "Auto-programar canchas", "Auto-programar sábado" ni la tabla de "preferencias de horario".

Expected: los 4 pasos funcionan sin errores en consola ni del servidor.

- [ ] **Step 5: Commit**

```bash
git add apps/web-admin/src/features/futbol/panels/FixturePanel.tsx
git rm apps/web-admin/src/features/futbol/panels/SaturdayGridPreview.tsx
git commit -m "feat(web-admin): sacar automatizacion del panel Fixture, agregar alta manual de cruce"
```
