# Fixture por modelo de cruces (Berger) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generar el fixture de un torneo con el modelo numérico de la liga (nombres de equipo, una vuelta, corrimiento Apertura/Clausura), dejarlo como borrador en el admin, permitir editar un cruce a mano, y publicarlo a clientes solo al confirmar.

**Architecture:** Funciones puras en `berger.ts` (tabla 1…N, numeración, desfasaje). `FixtureGeneratorService` escribe jornadas/partidos con `publicada=false`. `POST publish-fixture` publica todas las jornadas. `PATCH .../cruces` cambia un partido y devuelve avisos. El admin muestra una tabla tipo Cat. A y los botones Confirmar / Volver a generar.

**Tech Stack:** NestJS 11 + Prisma 5.22 + PostgreSQL 16 (`npm --prefix apps/api test` y `test:db`); React 18 + Vitest 3 en `apps/web-admin`. Spec: `docs/superpowers/specs/2026-09-11-fixture-modelo-cruces-design.md`.

## Global Constraints

- Todo el texto visible al usuario va en **español**.
- Una generación = **una vuelta** (N fechas si N impar, N−1 si N par). No hay selector de cantidad de fechas ni revancha.
- **No** agregar tablas ni campo `numeroFixture`. El 1…N existe solo al generar.
- **No** tocar auto-programar canchas, preferencias de horario, grilla del sábado, ni suspender por lluvia.
- `POST /football/torneos/:id/generate-fixture` body solo `{ fechaInicio }`. Se elimina `fechas`.
- Jornadas nuevas nacen con `publicada: false`. La web pública sigue filtrando por `jornada.publicada`.
- Editar un cruce **no** recalcula los demás partidos. Rechazo duro solo si local = visitante, partido 404, o inscripción inválida. El resto es `warnings[]`.
- Tests API: `npm --prefix apps/api test` (unit) y `npm --prefix apps/api run test:db` (Postgres). Front: `npm --prefix apps/web-admin test`.
- Commits en español, un commit por task.

## Setup de rama (antes de Task 1)

`feat/fixture-modelo-cruces` nació de un `main` viejo **sin** el overhaul de fútbol. Implementar sobre la rama que ya tiene `apps/api/src/football/fixture-generator.service.ts` (hoy `feat/pos-stock-config-paginacion`):

```bash
git checkout feat/pos-stock-config-paginacion
git checkout -b feat/fixture-modelo-cruces
git checkout feat/fixture-modelo-cruces -- docs/superpowers/specs/2026-09-11-fixture-modelo-cruces-design.md docs/superpowers/plans/2026-09-11-fixture-modelo-cruces.md
```

Si esos docs ya están en la rama de trabajo, no hace falta el último `checkout`. Confirmar que existen:

- `apps/api/src/football/fixture-generator.service.ts`
- `apps/web-admin/src/features/futbol/panels/FixturePanel.tsx`

---

## File Structure

### Nuevos archivos

| Archivo | Responsabilidad |
|---|---|
| `apps/api/src/football/berger.ts` | `buildBergerRounds`, `numberTeams`, `chooseOffset`, `bergerRoundToPairs`, `pairKey`. Cero Prisma. |
| `apps/api/test/berger.test.ts` | Tests puros contra las tablas del PDF. |
| `apps/api/src/football/cruce-warnings.ts` | `collectCruceWarnings` — avisos al editar un partido. |
| `apps/api/test/cruce-warnings.test.ts` | Tests de esos avisos. |
| `apps/api/test/db/fixture-berger.test.ts` | Postgres: generar, regenerar, corrimiento, publicar, PATCH cruces. |
| `apps/web-admin/src/features/futbol/panels/fixture-season-table.ts` | Agrupar jornadas+partidos en filas tipo Cat. A; `isFixtureRegenerable`. |
| `apps/web-admin/src/features/futbol/panels/fixture-season-table.test.ts` | Tests del agrupado y del flag de borrador. |
| `apps/web-admin/src/features/futbol/panels/FixtureSeasonTable.tsx` | Tabla visual + selects de cruce. |

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `apps/api/src/football/fixture-generator.service.ts` | Berger + una vuelta + regenerar borrador + corrimiento hermano. Deja de usar `buildRoundPairs` y el parámetro `fechas`. |
| `apps/api/src/football/football.service.ts` | `generateFullSeasonFixture(torneoId, fechaInicio)`; round-robin con Berger; `publishFixture`; `updateMatchCruces`. |
| `apps/api/src/football/football.controller.ts` | DTO sin `fechas`; `POST .../publish-fixture`; `PATCH matches/:id/cruces`. |
| `apps/api/src/football/dto.ts` | `GenerateFixtureDto` solo `fechaInicio`; `UpdateMatchCrucesDto`. |
| `apps/web-admin/src/app/api/client.ts` | Client de los tres endpoints. |
| `apps/web-admin/src/features/futbol/panels/FixturePanel.tsx` | Wizard sin cantidad de fechas; tabla de temporada; confirmar / regenerar; edición de cruces. |

`buildRoundPairs` se borra de `fixture-generator.service.ts` cuando nadie la importe. `createMatchesForPairs` se queda.

---

### Task 1: Motor Berger puro

**Files:**
- Create: `apps/api/src/football/berger.ts`
- Test: `apps/api/test/berger.test.ts`

**Interfaces:**
- Consumes: nada
- Produces:

```ts
export type BergerPair = { home: number; away: number };
export type BergerRound = { bye: number | null; pairs: BergerPair[] };

export function buildBergerRounds(n: number): BergerRound[];

export type NumberableInscription = {
  id: string;
  equipoId: string;
  equipo: { name: string };
};

export function numberTeams<T extends NumberableInscription>(rows: T[]): T[];

export function pairKey(a: string, b: string): string;

export function chooseOffset(
  rounds: BergerRound[],
  equipoIdByNumber: (n: number) => string,
  previousFechaByPair: Map<string, number>,
): { offset: number; choques: number };

export function bergerRoundToPairs<T extends { id: string; equipoId: string }>(
  round: BergerRound,
  numbered: T[],
): { pairs: [T, T][]; byeInscripcionId: string | null };
```

`numbered[0]` es el equipo 1. `equipoIdByNumber(1)` es `numbered[0].equipoId`.

- [ ] **Step 1: Write the failing test**

Crear `apps/api/test/berger.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  bergerRoundToPairs,
  buildBergerRounds,
  chooseOffset,
  numberTeams,
  pairKey,
} from '../src/football/berger';

function pairsOf(n: number, roundIndex: number) {
  const r = buildBergerRounds(n)[roundIndex];
  return { bye: r.bye, pairs: r.pairs.map((p) => [p.home, p.away] as const) };
}

describe('buildBergerRounds', () => {
  it('13 equipos fecha 1 = modelo PDF', () => {
    expect(pairsOf(13, 0)).toEqual({
      bye: 1,
      pairs: [
        [2, 13],
        [3, 12],
        [4, 11],
        [5, 10],
        [6, 9],
        [7, 8],
      ],
    });
  });

  it('13 equipos fecha 2 = modelo PDF', () => {
    expect(pairsOf(13, 1)).toEqual({
      bye: 8,
      pairs: [
        [9, 7],
        [10, 6],
        [11, 5],
        [12, 4],
        [13, 3],
        [1, 2],
      ],
    });
  });

  it('7 y 11 equipos fecha 1', () => {
    expect(pairsOf(7, 0)).toEqual({
      bye: 1,
      pairs: [
        [2, 7],
        [3, 6],
        [4, 5],
      ],
    });
    expect(pairsOf(11, 0)).toEqual({
      bye: 1,
      pairs: [
        [2, 11],
        [3, 10],
        [4, 9],
        [5, 8],
        [6, 7],
      ],
    });
  });

  it('8 equipos fecha 1 y fecha 2 (local/visitante del extra)', () => {
    expect(pairsOf(8, 0)).toEqual({
      bye: null,
      pairs: [
        [1, 8],
        [2, 7],
        [3, 6],
        [4, 5],
      ],
    });
    expect(pairsOf(8, 1)).toEqual({
      bye: null,
      pairs: [
        [8, 5],
        [6, 4],
        [7, 3],
        [1, 2],
      ],
    });
  });

  it('12 y 14 equipos fecha 1: N juega contra el 1', () => {
    expect(pairsOf(12, 0).pairs[0]).toEqual([1, 12]);
    expect(pairsOf(12, 0).bye).toBeNull();
    expect(pairsOf(14, 0).pairs[0]).toEqual([1, 14]);
  });

  it('13 equipos: cada par una vez y cada equipo un bye', () => {
    const rounds = buildBergerRounds(13);
    expect(rounds).toHaveLength(13);
    const seen = new Set<string>();
    const byes = new Map<number, number>();
    for (const r of rounds) {
      expect(r.bye).not.toBeNull();
      byes.set(r.bye!, (byes.get(r.bye!) ?? 0) + 1);
      const inRound = new Set<number>([r.bye!]);
      for (const p of r.pairs) {
        const key = p.home < p.away ? `${p.home}-${p.away}` : `${p.away}-${p.home}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        inRound.add(p.home);
        inRound.add(p.away);
      }
      expect(inRound.size).toBe(13);
    }
    expect(seen.size).toBe((13 * 12) / 2);
    for (let i = 1; i <= 13; i++) expect(byes.get(i)).toBe(1);
  });

  it('12 equipos: 11 fechas, cada par una vez, nadie libre', () => {
    const rounds = buildBergerRounds(12);
    expect(rounds).toHaveLength(11);
    const seen = new Set<string>();
    for (const r of rounds) {
      expect(r.bye).toBeNull();
      expect(r.pairs).toHaveLength(6);
      for (const p of r.pairs) {
        const key = p.home < p.away ? `${p.home}-${p.away}` : `${p.away}-${p.home}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe((12 * 11) / 2);
  });
});

describe('numberTeams', () => {
  it('ordena por nombre es y desempata por equipoId', () => {
    const rows = [
      { id: 'i2', equipoId: 'b', equipo: { name: 'Tortu' } },
      { id: 'i1', equipoId: 'a', equipo: { name: 'Discoteca A.F.' } },
      { id: 'i3', equipoId: 'c', equipo: { name: 'discoteca a.f.' } },
    ];
    const numbered = numberTeams(rows);
    expect(numbered.map((r) => r.id)).toEqual(['i1', 'i3', 'i2']);
  });
});

describe('chooseOffset', () => {
  it('con el mismo plantel y R>=2 elige s=1 y cero choques', () => {
    const rounds = buildBergerRounds(4);
    const ids = ['', 'A', 'B', 'C', 'D'];
    const prev = new Map<string, number>();
    rounds.forEach((r, i) => {
      for (const p of r.pairs) prev.set(pairKey(ids[p.home], ids[p.away]), i + 1);
    });
    const { offset, choques } = chooseOffset(rounds, (n) => ids[n], prev);
    expect(offset).toBe(1);
    expect(choques).toBe(0);
  });

  it('R=1 no corre', () => {
    const rounds = buildBergerRounds(2);
    const { offset } = chooseOffset(rounds, (n) => String(n), new Map([[pairKey('1', '2'), 1]]));
    expect(offset).toBe(0);
  });
});

describe('bergerRoundToPairs', () => {
  it('mapea número → inscripción y el bye', () => {
    const numbered = [
      { id: 'ins-1', equipoId: 'eq-1' },
      { id: 'ins-2', equipoId: 'eq-2' },
      { id: 'ins-3', equipoId: 'eq-3' },
    ];
    const { pairs, byeInscripcionId } = bergerRoundToPairs(buildBergerRounds(3)[0], numbered);
    expect(byeInscripcionId).toBe('ins-1');
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0].id).toBe('ins-2');
    expect(pairs[0][1].id).toBe('ins-3');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api test -- test/berger.test.ts`

Expected: FAIL — `Cannot find module '../src/football/berger'`

- [ ] **Step 3: Write minimal implementation**

Crear `apps/api/src/football/berger.ts` con esta lógica (no otra):

- N impar, ronda 0: bye=1, pares `(2,N), (3,N-1), …`.
- Ronda k (0-based), N impar: `offset = k par ? k/2 : floor(k/2)+(N+1)/2`. Cada etiqueta `x` → `((x-1+offset) mod N)+1`.
- N par: Berger de N−1; el partido extra va **primero**. k par: `{home: bye, away: N}`; k impar: `{home: N, away: bye}`.
- `numberTeams`: `localeCompare(name, 'es', { sensitivity: 'base' })`, empate `equipoId`.
- `pairKey`: ordenar los dos ids y unir con `|`.
- `chooseOffset`: si `R<=1` o mapa vacío → `{0,0}`. Buscar el menor `s` en `1…R-1` con 0 choques. Si no hay, incluir `s=0` y minimizar choques; empate → preferir `s≠0`, luego el más chico. Choque = un par de la jornada `i+1` (ronda `(i+offset) mod R`) cuya clave ya tenía `jornada.numero === i+1`.
- `bergerRoundToPairs`: `numbered[home-1]` / `numbered[away-1]`; bye → `numbered[bye-1].id` o null.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/api test -- test/berger.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/football/berger.ts apps/api/test/berger.test.ts
git commit -m "feat(futbol): motor Berger del modelo de cruces de la liga"
```

---

### Task 2: Generar una vuelta, regenerar borrador y correr Apertura/Clausura

**Files:**
- Modify: `apps/api/src/football/fixture-generator.service.ts`
- Modify: `apps/api/src/football/football.service.ts` (`generateFullSeasonFixture`, `generateRoundRobin`)
- Modify: `apps/api/src/football/dto.ts` (`GenerateFixtureDto`)
- Modify: `apps/api/src/football/football.controller.ts` (`generateFixture`)
- Test: `apps/api/test/db/fixture-berger.test.ts`

**Interfaces:**
- Consumes: `buildBergerRounds`, `numberTeams`, `chooseOffset`, `bergerRoundToPairs`, `pairKey`, `createMatchesForPairs`
- Produces:

```ts
// FixtureGeneratorService
generateFullSeason(torneoId: string, fechaInicio: string): Promise<{
  torneoId: string;
  jornadasCreadas: number;
  jornadas: { id: string; numero: number; fecha: Date; equipoLibreId: string | null }[];
  offset: number;
  choques: number;
  torneoReferenciaId: string | null;
}>;

// FootballService
generateFullSeasonFixture(torneoId: string, fechaInicio: string): Promise<...el mismo shape...>;

// GenerateFixtureDto
{ fechaInicio: string }  // sin `fechas`

// round-robin de una jornada: Berger de `jornada.numero - 1` (mod R), sin corrimiento de temporada
```

- [ ] **Step 1: Write the failing DB tests**

Crear `apps/api/test/db/fixture-berger.test.ts`. Copiar el patrón de `apps/api/test/db/football-constraints.test.ts` (`testPrisma`, `resetTestDb`).

Helpers en el mismo archivo:

```ts
import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { testPrisma, resetTestDb } from './helpers/db';
import { FixtureGeneratorService } from '../../src/football/fixture-generator.service';
import { PrismaService } from '../../src/common/prisma.service';
import { pairKey } from '../../src/football/berger';

const prisma = testPrisma();

async function seedCategoriaYTemporada() {
  const temporada = await prisma.temporada.create({
    data: { nombre: '2026', anio: 2026, inicio: new Date(), fin: new Date() },
  });
  const categoria = await prisma.categoriaConfig.create({
    data: {
      codigo: `cat_${Date.now()}`,
      nombre: 'Libre A',
      genero: 'hombres',
      maxPlantel: 18,
      minJugadoresInicio: 7,
    },
  });
  return { temporada, categoria };
}

async function seedTorneoConEquipos(
  temporadaId: string,
  categoriaId: string,
  campeonatoNombre: string,
  names: string[],
) {
  const campeonato = await prisma.campeonato.create({
    data: { temporadaId, nombre: campeonatoNombre },
  });
  const torneo = await prisma.torneo.create({
    data: { campeonatoId: campeonato.id, categoriaId, nombre: `${campeonatoNombre} Libre A` },
  });
  const inscripciones = [];
  for (const name of names) {
    const equipo = await prisma.equipoFutbol.create({ data: { name } });
    inscripciones.push(
      await prisma.equipoInscripcion.create({ data: { torneoId: torneo.id, equipoId: equipo.id } }),
    );
  }
  return { campeonato, torneo, inscripciones };
}

function generator() {
  return new FixtureGeneratorService(prisma as unknown as PrismaService);
}
```

Tests:

```ts
describe('generateFullSeason Berger', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('13 equipos → 13 jornadas no publicadas y un libre por fecha', async () => {
    const { temporada, categoria } = await seedCategoriaYTemporada();
    const names = Array.from({ length: 13 }, (_, i) => `Equipo ${String(i + 1).padStart(2, '0')}`);
    const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', names);
    const result = await generator().generateFullSeason(torneo.id, '2026-08-22');
    expect(result.jornadasCreadas).toBe(13);
    expect(result.offset).toBe(0);
    expect(result.torneoReferenciaId).toBeNull();
    const jornadas = await prisma.jornada.findMany({ where: { torneoId: torneo.id }, orderBy: { numero: 'asc' } });
    expect(jornadas.every((j) => j.publicada === false)).toBe(true);
    expect(jornadas.every((j) => j.equipoLibreId)).toBe(true);
    const f1 = await prisma.partidoFutbol.count({ where: { jornadaId: jornadas[0].id } });
    expect(f1).toBe(6);
  });

  it('12 equipos → 11 jornadas y sin libre', async () => {
    const { temporada, categoria } = await seedCategoriaYTemporada();
    const names = Array.from({ length: 12 }, (_, i) => `Club ${i}`);
    const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', names);
    const result = await generator().generateFullSeason(torneo.id, '2026-08-22');
    expect(result.jornadasCreadas).toBe(11);
    const jornadas = await prisma.jornada.findMany({ where: { torneoId: torneo.id } });
    expect(jornadas.every((j) => j.equipoLibreId == null)).toBe(true);
  });

  it('mismo plantel Apertura luego Clausura: cero cruces con el mismo número de fecha', async () => {
    const { temporada, categoria } = await seedCategoriaYTemporada();
    const names = ['Alfa', 'Beta', 'Gamma', 'Delta'];
    const a = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', names);
    await generator().generateFullSeason(a.torneo.id, '2026-03-07');
    const campeonatoC = await prisma.campeonato.create({
      data: { temporadaId: temporada.id, nombre: 'Clausura' },
    });
    const torneoC = await prisma.torneo.create({
      data: { campeonatoId: campeonatoC.id, categoriaId: categoria.id, nombre: 'Clausura Libre A' },
    });
    for (const insc of a.inscripciones) {
      await prisma.equipoInscripcion.create({
        data: { torneoId: torneoC.id, equipoId: insc.equipoId },
      });
    }
    const result = await generator().generateFullSeason(torneoC.id, '2026-08-22');
    expect(result.offset).toBeGreaterThan(0);
    expect(result.choques).toBe(0);
    expect(result.torneoReferenciaId).toBe(a.torneo.id);

    const prev = await prisma.partidoFutbol.findMany({
      where: { torneoId: a.torneo.id },
      include: { jornada: true },
    });
    const next = await prisma.partidoFutbol.findMany({
      where: { torneoId: torneoC.id },
      include: { jornada: true },
    });
    const prevMap = new Map(prev.map((p) => [pairKey(p.homeTeamId, p.awayTeamId), p.jornada!.numero]));
    for (const p of next) {
      expect(prevMap.get(pairKey(p.homeTeamId, p.awayTeamId))).not.toBe(p.jornada!.numero);
    }
  });

  it('regenera un borrador y rechaza si hay jornada publicada o resultado', async () => {
    const { temporada, categoria } = await seedCategoriaYTemporada();
    const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', ['Uno', 'Dos', 'Tres']);
    await generator().generateFullSeason(torneo.id, '2026-08-22');
    const second = await generator().generateFullSeason(torneo.id, '2026-08-29');
    expect(second.jornadasCreadas).toBe(3);
    const count = await prisma.jornada.count({ where: { torneoId: torneo.id } });
    expect(count).toBe(3);

    await prisma.jornada.updateMany({ where: { torneoId: torneo.id }, data: { publicada: true } });
    await expect(generator().generateFullSeason(torneo.id, '2026-09-05')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
```

Añadir un `it` extra en el de regenerar: en vez de publicar, poner `status: 'jugado'` y `homeGoals/awayGoals` en un partido y esperar 400. Puede ser el mismo test partido en dos `it`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts`

Expected: FAIL — `generateFullSeason` todavía pide `fechas` o no regenera / no devuelve `offset`.

- [ ] **Step 3: Implement generator + DTO + round-robin**

`GenerateFixtureDto`: borrar `fechas`. Dejar solo `@IsDateString() fechaInicio: string`.

Controller:

```ts
generateFixture(@Param('id') id: string, @Body() body: GenerateFixtureDto) {
  return this.footballService.generateFullSeasonFixture(id, body.fechaInicio);
}
```

`FootballService.generateFullSeasonFixture(torneoId, fechaInicio)` llama `this.fixtureGenerator.generateFullSeason(torneoId, fechaInicio)`.

`generateFullSeason` (una transacción):

1. Torneo con `include: { campeonato: true }`. 404 si no existe.
2. Inscripciones activas con `equipo`. 400 si `< 2`.
3. Si hay jornadas: regenerable solo si **ninguna** `publicada` y **ningún** partido del torneo tiene `status !== 'pendiente'` o goles no nulos o `esWO`. Si no, 400 con el mensaje actual (*"El torneo ya tiene jornadas cargadas..."*). Si sí: `partidoFutbol.deleteMany({ where: { torneoId } })` y después `jornada.deleteMany({ where: { torneoId } })`.
4. `numbered = numberTeams(inscripciones)`, `rounds = buildBergerRounds(numbered.length)`.
5. Hermano: otro `Campeonato` de la misma `temporadaId`; en ese campeonato el `Torneo` con el mismo `categoriaId`. Si tiene partidos, armar `Map` `pairKey(homeTeamId,awayTeamId) → jornada.numero`. `chooseOffset`. Si no hay hermano, `{ offset: 0, choques: 0, torneoReferenciaId: null }`.
6. Para `i` en `0 … R-1`: ronda `rounds[(i + offset) % R]`, fecha `fechaInicio + i*7` días (mismo `new Date(fechaInicio); setDate(+ i*7)` que hoy), `bergerRoundToPairs`, crear jornada `numero: i+1`, `publicada` default false, `equipoLibreId`, `createMatchesForPairs`.
7. Return `{ torneoId, jornadasCreadas, jornadas, offset, choques, torneoReferenciaId }`.

`generateRoundRobin`: dejar las validaciones actuales. En vez de `buildRoundPairs(inscripciones, roundIndex)`:

```ts
const numbered = numberTeams(inscripciones);
const rounds = buildBergerRounds(numbered.length);
const round = rounds[roundIndex % rounds.length];
const { pairs, byeInscripcionId } = bergerRoundToPairs(round, numbered);
```

Borrar `buildRoundPairs` y su JSDoc si ya no tiene imports. Actualizar imports de `football.service.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts`

Expected: PASS

También: `npm --prefix apps/api test -- test/berger.test.ts` sigue PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/football/fixture-generator.service.ts apps/api/src/football/football.service.ts apps/api/src/football/dto.ts apps/api/src/football/football.controller.ts apps/api/test/db/fixture-berger.test.ts
git commit -m "feat(futbol): generar una vuelta Berger y correr fechas vs el otro campeonato"
```

---

### Task 3: Confirmar y publicar el fixture del torneo

**Files:**
- Modify: `apps/api/src/football/football.service.ts`
- Modify: `apps/api/src/football/football.controller.ts`
- Modify: `apps/api/test/db/fixture-berger.test.ts`

**Interfaces:**
- Consumes: jornadas del torneo
- Produces:

```ts
FootballService.publishFixture(torneoId: string): Promise<{ torneoId: string; publicadas: number }>;
// POST /football/torneos/:id/publish-fixture   FOOTBALL_MUTATION_ROLES
```

Errores: 400 si no hay jornadas; 400 si **alguna** ya está `publicada` (no toca nada).

- [ ] **Step 1: Write the failing tests** (append in `fixture-berger.test.ts`)

Importar `FootballService` y `PublicService` solo si el constructor de `FootballService` se puede armar con Prisma. Si `FootballService` pide demasiados deps, **no** instanciarlo: extraer `publishFixture` a `FixtureGeneratorService` **o** llamar prisma en el test contra un método nuevo en el generator. Preferir agregar `publishFixture` en `FootballService` y, en el test de DB, ejecutar la misma actualización vía una función exportada **o** instanciar `FootballService` con mocks de los otros servicios.

Camino YAGNI que evita el constructor gordo: poner `publishFixture` en `FixtureGeneratorService` (mismo archivo que ya se instancia en el test) y que `FootballService` lo delegue. El controller llama `footballService.publishFixture`.

Test:

```ts
it('publishFixture publica todas; sin jornadas o ya publicadas → 400', async () => {
  const { temporada, categoria } = await seedCategoriaYTemporada();
  const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', ['Uno', 'Dos', 'Tres']);
  const gen = generator();
  await expect(gen.publishFixture(torneo.id)).rejects.toBeInstanceOf(BadRequestException);
  await gen.generateFullSeason(torneo.id, '2026-08-22');
  const pub = await gen.publishFixture(torneo.id);
  expect(pub.publicadas).toBe(3);
  const jornadas = await prisma.jornada.findMany({ where: { torneoId: torneo.id } });
  expect(jornadas.every((j) => j.publicada)).toBe(true);
  await expect(gen.publishFixture(torneo.id)).rejects.toBeInstanceOf(BadRequestException);
});

it('getTorneoDetail no lista partidos de jornada no publicada y sí después de publicar', async () => {
  const { temporada, categoria } = await seedCategoriaYTemporada();
  const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', ['Uno', 'Dos', 'Tres']);
  await prisma.torneo.update({ where: { id: torneo.id }, data: { publicado: true, activo: true } });
  await prisma.campeonato.update({ where: { id: (await prisma.torneo.findUnique({ where: { id: torneo.id } }))!.campeonatoId }, data: { activo: true } });
  await generator().generateFullSeason(torneo.id, '2026-08-22');

  const hidden = await prisma.partidoFutbol.findMany({
    where: {
      torneoId: torneo.id,
      jornada: { publicada: true, suspendida: false },
    },
  });
  expect(hidden).toHaveLength(0);

  await generator().publishFixture(torneo.id);
  const visible = await prisma.partidoFutbol.findMany({
    where: {
      torneoId: torneo.id,
      jornada: { publicada: true, suspendida: false },
    },
  });
  expect(visible.length).toBeGreaterThan(0);
});
```

Ese filtro es el mismo criterio que `getTorneoDetail` (`jornada.publicada && !jornada.suspendida`). No hace falta instanciar `PublicService` ni `ReglamentoEngine`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts`

Expected: FAIL — `publishFixture is not a function`

- [ ] **Step 3: Implement publishFixture + route**

En `FixtureGeneratorService`:

```ts
async publishFixture(torneoId: string) {
  const jornadas = await this.prisma.jornada.findMany({ where: { torneoId } });
  if (jornadas.length === 0) {
    throw new BadRequestException('No hay jornadas para publicar');
  }
  if (jornadas.some((j) => j.publicada)) {
    throw new BadRequestException('El fixture ya tiene jornadas publicadas');
  }
  const updated = await this.prisma.jornada.updateMany({
    where: { torneoId },
    data: { publicada: true },
  });
  return { torneoId, publicadas: updated.count };
}
```

`FootballService.publishFixture(id)` → `this.fixtureGenerator.publishFixture(id)`.

Controller, junto a `generate-fixture`:

```ts
@Post('torneos/:id/publish-fixture')
@Roles(...FOOTBALL_MUTATION_ROLES)
publishFixture(@Param('id') id: string) {
  return this.footballService.publishFixture(id);
}
```

Importar `Patch` no hace falta aún.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/football/fixture-generator.service.ts apps/api/src/football/football.service.ts apps/api/src/football/football.controller.ts apps/api/test/db/fixture-berger.test.ts
git commit -m "feat(futbol): confirmar publica todas las jornadas del fixture"
```

---

### Task 4: Editar un cruce a mano

**Files:**
- Create: `apps/api/src/football/cruce-warnings.ts`
- Test: `apps/api/test/cruce-warnings.test.ts`
- Modify: `apps/api/src/football/football.service.ts`
- Modify: `apps/api/src/football/dto.ts`
- Modify: `apps/api/src/football/football.controller.ts`
- Modify: `apps/api/test/db/fixture-berger.test.ts`

**Interfaces:**
- Consumes: partido + inscripciones del torneo
- Produces:

```ts
export const CRUCE_WARNINGS = {
  dobleEnFecha: 'Un equipo juega dos veces en esta fecha.',
  fechaIncoherente: 'La fecha queda incoherente: hay equipos sin partido y el libre no cierra.',
  cruceRepetido: 'Este cruce ya existe en otra fecha del torneo.',
  resultadoOPublicado:
    'El partido ya tiene resultado, WO o la jornada está publicada. La tabla de posiciones puede quedar desfasada.',
} as const;

export type CruceWarningInput = {
  matchId: string;
  nuevaHomeInscripcionId: string;
  nuevaAwayInscripcionId: string;
  jornadaPublicada: boolean;
  matchTieneResultado: boolean; // status!=='pendiente' || goles no nulos || esWO
  inscripcionIdsTorneo: string[];
  partidosJornada: { id: string; homeInscripcionId: string | null; awayInscripcionId: string | null }[];
  paresOtrasJornadas: { homeTeamId: string; awayTeamId: string }[];
  nuevaHomeTeamId: string;
  nuevaAwayTeamId: string;
};

export function collectCruceWarnings(input: CruceWarningInput): string[];

// FootballService
updateMatchCruces(id: string, homeInscripcionId: string, awayInscripcionId: string): Promise<{
  match: /* include matchInclude() */;
  warnings: string[];
}>;

// PATCH /football/matches/:id/cruces
// body: { homeInscripcionId: string; awayInscripcionId: string }
```

Tras un PATCH válido: si exactamente un inscripto del torneo no aparece en los partidos de esa jornada, `jornada.equipoLibreId = ese id`; si no, `equipoLibreId = null`. No se reescriben otros partidos.

- [ ] **Step 1: Write the failing unit tests**

`apps/api/test/cruce-warnings.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { collectCruceWarnings, CRUCE_WARNINGS } from '../src/football/cruce-warnings';

const base = {
  matchId: 'm1',
  nuevaHomeInscripcionId: 'h',
  nuevaAwayInscripcionId: 'a',
  jornadaPublicada: false,
  matchTieneResultado: false,
  inscripcionIdsTorneo: ['h', 'a', 'x', 'y'],
  partidosJornada: [
    { id: 'm1', homeInscripcionId: 'h', awayInscripcionId: 'a' },
    { id: 'm2', homeInscripcionId: 'x', awayInscripcionId: 'y' },
  ],
  paresOtrasJornadas: [] as { homeTeamId: string; awayTeamId: string }[],
  nuevaHomeTeamId: 'th',
  nuevaAwayTeamId: 'ta',
};

describe('collectCruceWarnings', () => {
  it('avisa si un equipo queda dos veces en la fecha', () => {
    const warnings = collectCruceWarnings({
      ...base,
      nuevaAwayInscripcionId: 'x',
      nuevaAwayTeamId: 'tx',
    });
    expect(warnings).toContain(CRUCE_WARNINGS.dobleEnFecha);
    expect(warnings).toContain(CRUCE_WARNINGS.fechaIncoherente);
  });

  it('avisa cruce repetido en otra jornada', () => {
    const warnings = collectCruceWarnings({
      ...base,
      paresOtrasJornadas: [{ homeTeamId: 'ta', awayTeamId: 'th' }],
    });
    expect(warnings).toContain(CRUCE_WARNINGS.cruceRepetido);
  });

  it('avisa si hay resultado o jornada publicada', () => {
    expect(
      collectCruceWarnings({ ...base, matchTieneResultado: true }),
    ).toContain(CRUCE_WARNINGS.resultadoOPublicado);
    expect(
      collectCruceWarnings({ ...base, jornadaPublicada: true }),
    ).toContain(CRUCE_WARNINGS.resultadoOPublicado);
  });

  it('sin problemas no avisa', () => {
    expect(collectCruceWarnings(base)).toEqual([]);
  });
});
```

Para `dobleEnFecha`: al armar el conteo, el partido `m1` usa las **nuevas** inscripciones; `m2` sigue igual. Si away pasa a `x`, `x` aparece en m1 y m2; `a` y `y`/`h` según corresponda — `a` queda ausente junto con nadie… inscripciones h,a,x,y: m1 h-x, m2 x-y → x dos veces, a ausente → doble + incoherente.

- [ ] **Step 2: Run unit test to verify it fails**

Run: `npm --prefix apps/api test -- test/cruce-warnings.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement collectCruceWarnings**

En `cruce-warnings.ts`: clonar `partidosJornada`, reemplazar el de `matchId` por las nuevas ids, contar apariciones de cada inscripción. Si alguna `> 1` → `dobleEnFecha`. Ausentes = inscripciones del torneo que no aparecen. Si `ausentes.length === 1` está bien (libre). Si `ausentes.length === 0` está bien (N par). Cualquier otro length → `fechaIncoherente`. Cruce repetido: `pairKey(nuevaHomeTeamId, nuevaAwayTeamId)` está en `paresOtrasJornadas`. Resultado/publicado → el cuarto aviso. Devolver array sin duplicar el mismo string.

- [ ] **Step 4: Run unit test to verify it passes**

Run: `npm --prefix apps/api test -- test/cruce-warnings.test.ts`

Expected: PASS

- [ ] **Step 5: Write failing DB tests for persist**

`updateMatchCruces` vive en `FixtureGeneratorService` (el test ya instancia eso) y `FootballService` solo delega, igual que `publishFixture`.

Append:

```ts
it('updateMatchCruces cambia solo ese partido y avisa si pisa un rival de la fecha', async () => {
  const { temporada, categoria } = await seedCategoriaYTemporada();
  const { torneo } = await seedTorneoConEquipos(
    temporada.id,
    categoria.id,
    'Apertura',
    ['Alfa', 'Beta', 'Gamma', 'Delta'],
  );
  const gen = generator();
  await gen.generateFullSeason(torneo.id, '2026-08-22');
  const j1 = await prisma.jornada.findFirst({ where: { torneoId: torneo.id, numero: 1 } });
  const partidos = await prisma.partidoFutbol.findMany({ where: { jornadaId: j1!.id } });
  expect(partidos.length).toBeGreaterThanOrEqual(2);
  const [m1, m2] = partidos;
  const otherIds = await prisma.partidoFutbol.findMany({ where: { jornadaId: j1!.id } });

  const result = await gen.updateMatchCruces(m1.id, m1.homeInscripcionId!, m2.homeInscripcionId!);
  expect(result.warnings).toContain(CRUCE_WARNINGS.dobleEnFecha);
  const reloaded = await prisma.partidoFutbol.findUnique({ where: { id: m1.id } });
  expect(reloaded?.awayInscripcionId).toBe(m2.homeInscripcionId);
  const m2After = await prisma.partidoFutbol.findUnique({ where: { id: m2.id } });
  expect(m2After?.homeInscripcionId).toBe(m2.homeInscripcionId);
  expect(m2After?.awayInscripcionId).toBe(m2.awayInscripcionId);
  expect(otherIds).toHaveLength(partidos.length);
});

it('updateMatchCruces rechaza el mismo equipo y el id inexistente', async () => {
  const { temporada, categoria } = await seedCategoriaYTemporada();
  const { torneo, inscripciones } = await seedTorneoConEquipos(
    temporada.id,
    categoria.id,
    'Apertura',
    ['Alfa', 'Beta', 'Gamma'],
  );
  const gen = generator();
  await gen.generateFullSeason(torneo.id, '2026-08-22');
  const m = await prisma.partidoFutbol.findFirst({ where: { torneoId: torneo.id } });
  await expect(gen.updateMatchCruces(m!.id, inscripciones[0].id, inscripciones[0].id)).rejects.toBeInstanceOf(
    BadRequestException,
  );
  await expect(gen.updateMatchCruces('00000000-0000-0000-0000-000000000000', inscripciones[0].id, inscripciones[1].id)).rejects.toBeInstanceOf(
    NotFoundException,
  );
});
```

Importar `CRUCE_WARNINGS` y `NotFoundException` arriba del archivo de test.

- [ ] **Step 6: Run DB test to verify it fails**

Run: `npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts`

Expected: FAIL — `updateMatchCruces is not a function`

- [ ] **Step 7: Implement updateMatchCruces + DTO + route**

`UpdateMatchCrucesDto`: `@IsUUID() homeInscripcionId`, `@IsUUID() awayInscripcionId`.

`FixtureGeneratorService.updateMatchCruces`:

- `findUnique` partido con jornada. 404 si no.
- Si `homeInscripcionId === awayInscripcionId` → 400 `'Local y visitante no pueden ser el mismo equipo'`.
- Cargar ambas inscripciones `activo: true` y `torneoId` del partido. 400 si falta alguna.
- Cargar partidos de la jornada y del resto del torneo.
- `warnings = collectCruceWarnings(...)`.
- `update` partido: `homeInscripcionId`, `awayInscripcionId`, `homeTeamId`, `awayTeamId` (desde las inscripciones). No tocar cancha/hora/`bloqueadoManual`.
- Recalcular `equipoLibreId` de la jornada como dice el spec.
- Devolver `{ match: findUnique include homeTeam/awayTeam/jornada, warnings }`.

`FootballService.updateMatchCruces` delega.

Controller: importar `Patch`.

```ts
@Patch('matches/:id/cruces')
@Roles(...FOOTBALL_MUTATION_ROLES)
updateMatchCruces(@Param('id') id: string, @Body() body: UpdateMatchCrucesDto) {
  return this.footballService.updateMatchCruces(id, body.homeInscripcionId, body.awayInscripcionId);
}
```

- [ ] **Step 8: Run all related tests**

Run:

```
npm --prefix apps/api test -- test/cruce-warnings.test.ts test/berger.test.ts
npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts
```

Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/football/cruce-warnings.ts apps/api/test/cruce-warnings.test.ts apps/api/src/football/fixture-generator.service.ts apps/api/src/football/football.service.ts apps/api/src/football/dto.ts apps/api/src/football/football.controller.ts apps/api/test/db/fixture-berger.test.ts
git commit -m "feat(futbol): editar un cruce a mano con avisos, sin recalcular la fecha"
```

---

### Task 5: Admin — tabla Cat. A, confirmar, regenerar, editar

**Files:**
- Create: `apps/web-admin/src/features/futbol/panels/fixture-season-table.ts`
- Test: `apps/web-admin/src/features/futbol/panels/fixture-season-table.test.ts`
- Create: `apps/web-admin/src/features/futbol/panels/FixtureSeasonTable.tsx`
- Modify: `apps/web-admin/src/app/api/client.ts`
- Modify: `apps/web-admin/src/features/futbol/panels/FixturePanel.tsx`

**Interfaces:**
- Consumes: `FootballJornada`, `FootballMatch`, `FootballInscription` de `client.ts`; endpoints Task 2–4
- Produces:

```ts
export type SeasonTableRow = {
  jornada: FootballJornada;
  libreNombre: string | null;
  partidos: FootballMatch[];
};

export function buildSeasonTable(
  jornadas: FootballJornada[],
  matches: FootballMatch[],
  inscripciones: FootballInscription[],
): SeasonTableRow[];

export function isFixtureRegenerable(
  jornadas: FootballJornada[],
  matches: Array<{
    status: string;
    homeGoals?: number | null;
    awayGoals?: number | null;
    esWO?: boolean;
  }>,
): boolean;

// footballApi
generateFixture(torneoId, { fechaInicio }, token)
publishFixture(torneoId, token)
matches.updateCruces(id, { homeInscripcionId, awayInscripcionId }, token)
```

El admin **no** tiene Testing Library. Los tests de UI son de las funciones puras. El TSX se verifica a ojo contra este step.

- [ ] **Step 1: Write the failing front tests**

`fixture-season-table.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSeasonTable, isFixtureRegenerable } from './fixture-season-table';
import type { FootballJornada, FootballMatch, FootballInscription } from '@/app/api/client';

const j1 = { id: 'j1', torneoId: 't', numero: 1, fecha: '2026-08-22', suspendida: false, esRecuperacion: false, publicada: false, equipoLibreId: 'i3' } satisfies FootballJornada;
const j2 = { ...j1, id: 'j2', numero: 2, equipoLibreId: null, publicada: false };

const inscripciones = [
  { id: 'i1', torneoId: 't', equipoId: 'e1', equipo: { id: 'e1', name: 'Alfa' } },
  { id: 'i2', torneoId: 't', equipoId: 'e2', equipo: { id: 'e2', name: 'Beta' } },
  { id: 'i3', torneoId: 't', equipoId: 'e3', equipo: { id: 'e3', name: 'Gamma' } },
] as FootballInscription[];

const matches = [
  { id: 'm1', homeTeamId: 'e1', awayTeamId: 'e2', date: '', status: 'pendiente', jornadaId: 'j1', homeTeam: { id: 'e1', name: 'Alfa' }, awayTeam: { id: 'e2', name: 'Beta' } },
  { id: 'm2', homeTeamId: 'e1', awayTeamId: 'e3', date: '', status: 'pendiente', jornadaId: 'j2', homeTeam: { id: 'e1', name: 'Alfa' }, awayTeam: { id: 'e3', name: 'Gamma' } },
] as FootballMatch[];

describe('buildSeasonTable', () => {
  it('arma filas por jornada con nombres, no números', () => {
    const rows = buildSeasonTable([j2, j1], matches, inscripciones);
    expect(rows.map((r) => r.jornada.numero)).toEqual([1, 2]);
    expect(rows[0].libreNombre).toBe('Gamma');
    expect(rows[0].partidos[0].homeTeam?.name).toBe('Alfa');
    expect(rows[0].partidos[0].awayTeam?.name).toBe('Beta');
  });
});

describe('isFixtureRegenerable', () => {
  it('true solo con jornadas, ninguna publicada y sin resultados', () => {
    expect(isFixtureRegenerable([j1], matches)).toBe(true);
    expect(isFixtureRegenerable([], matches)).toBe(false);
    expect(isFixtureRegenerable([{ ...j1, publicada: true }], matches)).toBe(false);
    expect(isFixtureRegenerable([j1], [{ ...matches[0], status: 'jugado' }])).toBe(false);
  });
});
```

Ajustar el `satisfies` / casts si `FootballInscription` / `FootballTeam` piden más campos: completar con los opcionales que pida el type (`abbr`, etc. como `undefined`).

- [ ] **Step 2: Run test to verify it fails**

Run: `npm --prefix apps/web-admin test -- src/features/futbol/panels/fixture-season-table.test.ts`

Expected: FAIL — module not found

- [ ] **Step 3: Implement helpers**

`buildSeasonTable`: ordenar jornadas por `numero`. Para cada una, partidos con `jornadaId === j.id` (orden estable: `id`). `libreNombre` = `inscripciones.find(i => i.id === j.equipoLibreId)?.equipo?.name ?? null`.

`isFixtureRegenerable`: `jornadas.length > 0`, ninguna `publicada`, ningún match con `status !== 'pendiente'` o goles no nulos o `esWO`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm --prefix apps/web-admin test -- src/features/futbol/panels/fixture-season-table.test.ts`

Expected: PASS

- [ ] **Step 5: Wire client.ts**

En `footballApi` (el bloque que ya tiene `generateFixture`):

```ts
generateFixture: (
  torneoId: string,
  data: { fechaInicio: string },
  token: string,
) =>
  apiFetch<{
    torneoId: string;
    jornadasCreadas: number;
    jornadas: FootballJornada[];
    offset: number;
    choques: number;
    torneoReferenciaId: string | null;
  }>(`/football/torneos/${torneoId}/generate-fixture`, { method: 'POST', token, body: data }),

publishFixture: (torneoId: string, token: string) =>
  apiFetch<{ torneoId: string; publicadas: number }>(
    `/football/torneos/${torneoId}/publish-fixture`,
    { method: 'POST', token },
  ),
```

En `footballApi.matches` (junto a `updateSchedule`):

```ts
updateCruces: (
  id: string,
  data: { homeInscripcionId: string; awayInscripcionId: string },
  token: string,
) =>
  apiFetch<{ match: FootballMatch; warnings: string[] }>(
    `/football/matches/${id}/cruces`,
    { method: 'PATCH', token, body: data },
  ),
```

Si `FootballMatch` no tiene `esWO`, agregarlo opcional: `esWO?: boolean`.

- [ ] **Step 6: Wizard y panel**

`TorneoFixtureWizard`:

- Borrar state `fechas` y el input “Cantidad de fechas”.
- Grid a 2 columnas: fecha de inicio + botón.
- Copy: *“Arma una vuelta completa con el modelo de la liga. Queda como borrador: la web de clientes no lo ve hasta que confirmes.”*
- `generateFixture(torneoId, { fechaInicio }, token)`.
- Si la respuesta trae `offset > 0`, el success puede decir: *“Corrimiento vs el otro campeonato: ${offset} fecha(s).”*

`FixturePanel.reload`: además de partidos de la jornada seleccionada, cargar `footballApi.matches.list(token, { torneoId })` en un state `seasonMatches` (el listado por `torneoId` ya existe en el client).

Debajo del wizard, no dentro de Avanzado:

- Si `jornadas.length > 0` y ninguna `publicada`: botón **Confirmar y publicar** → `footballApi.publishFixture`. Success: *“Fixture publicado en la web de clientes.”*
- Si `isFixtureRegenerable(jornadas, seasonMatches)`: botón **Volver a generar** → `confirm('Se borra el borrador y se arma de nuevo. ¿Seguir?')` y reenvía el wizard (hace falta la `fechaInicio` del form; guardar el último `fechaInicio` usado en state del wizard o un state del panel).
- Si alguna jornada ya está publicada, no mostrar confirmar (el publicar suelto de Avanzado sigue).

Renderizar `<FixtureSeasonTable>` cuando `seasonMatches.length > 0`.

`FixtureSeasonTable.tsx`: tabla HTML (mismos bordes que `FixtureGridPreview`). Filas = `buildSeasonTable`. Columnas: Fecha | Libre | Partido 1…k. Cada celda de partido: dos `<select>` (local, visitante) con las inscripciones. `onChange` llama `onCruceChange(matchId, homeInscripcionId, awayInscripcionId)`. Libre es texto.

En `FixturePanel`, handler:

```ts
async function updateCruce(matchId: string, homeInscripcionId: string, awayInscripcionId: string) {
  const token = getAccessToken();
  if (!token) return;
  const result = await footballApi.matches.updateCruces(matchId, { homeInscripcionId, awayInscripcionId }, token);
  if (result.warnings.length) setScheduleWarnings(result.warnings); // o un state `cruceWarnings`
  else setScheduleWarnings([]);
  await reload();
}
```

Mostrar esos avisos en el mismo recuadro ámbar que ya usan los avisos de horario.

No sacar Avanzado, sábado, canchas, lluvia.

Quitar del wizard el `type="number"` de fechas. El sábado-warning se queda.

- [ ] **Step 7: Run front tests and typecheck**

Run:

```
npm --prefix apps/web-admin test -- src/features/futbol/panels/fixture-season-table.test.ts
npm --prefix apps/web-admin run build
```

Expected: tests PASS; build sin error de tipos en `generateFixture` (ya no manda `fechas`).

- [ ] **Step 8: Commit**

```bash
git add apps/web-admin/src/features/futbol/panels/fixture-season-table.ts apps/web-admin/src/features/futbol/panels/fixture-season-table.test.ts apps/web-admin/src/features/futbol/panels/FixtureSeasonTable.tsx apps/web-admin/src/features/futbol/panels/FixturePanel.tsx apps/web-admin/src/app/api/client.ts
git commit -m "feat(admin): tabla de fixture con nombres, confirmar a clientes y editar cruces"
```

---

## Verificación final (después de Task 5)

```
npm --prefix apps/api test -- test/berger.test.ts test/cruce-warnings.test.ts
npm --prefix apps/api run test:db -- test/db/fixture-berger.test.ts
npm --prefix apps/web-admin test -- src/features/futbol/panels/fixture-season-table.test.ts
npm --prefix apps/api run build
npm --prefix apps/web-admin run build
```

A mano en el admin (no hay browser test en este plan):

1. Torneo con 13 equipos, sin jornadas. Generar un sábado. Ver tabla con **nombres**. Clientes no muestran fixture.
2. Cambiar un rival; aparece aviso si pisa; se guarda.
3. Confirmar y publicar → clientes ven las fechas.
4. Volver a generar está oculto. Un segundo torneo de la misma categoría en Clausura no repite número de fecha para el mismo cruce.
