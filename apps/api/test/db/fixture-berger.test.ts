import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { testPrisma, resetTestDb } from './helpers/db';
import { FixtureGeneratorService } from '../../src/football/fixture-generator.service';
import { PrismaService } from '../../src/common/prisma.service';
import { pairKey } from '../../src/football/berger';
import { CRUCE_WARNINGS } from '../../src/football/cruce-warnings';

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
    const jornadas = await prisma.jornada.findMany({
      where: { torneoId: torneo.id },
      orderBy: { numero: 'asc' },
    });
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

  it('regenera un borrador', async () => {
    const { temporada, categoria } = await seedCategoriaYTemporada();
    const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', [
      'Uno',
      'Dos',
      'Tres',
    ]);
    await generator().generateFullSeason(torneo.id, '2026-08-22');
    const second = await generator().generateFullSeason(torneo.id, '2026-08-29');
    expect(second.jornadasCreadas).toBe(3);
    const count = await prisma.jornada.count({ where: { torneoId: torneo.id } });
    expect(count).toBe(3);
  });

  it('rechaza regenerar si hay una jornada publicada', async () => {
    const { temporada, categoria } = await seedCategoriaYTemporada();
    const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', [
      'Uno',
      'Dos',
      'Tres',
    ]);
    await generator().generateFullSeason(torneo.id, '2026-08-22');
    await prisma.jornada.updateMany({ where: { torneoId: torneo.id }, data: { publicada: true } });
    await expect(generator().generateFullSeason(torneo.id, '2026-09-05')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rechaza regenerar si hay un resultado', async () => {
    const { temporada, categoria } = await seedCategoriaYTemporada();
    const { torneo } = await seedTorneoConEquipos(temporada.id, categoria.id, 'Apertura', [
      'Uno',
      'Dos',
      'Tres',
    ]);
    await generator().generateFullSeason(torneo.id, '2026-08-22');
    const partido = await prisma.partidoFutbol.findFirstOrThrow({ where: { torneoId: torneo.id } });
    await prisma.partidoFutbol.update({
      where: { id: partido.id },
      data: { status: 'jugado', homeGoals: 1, awayGoals: 0 },
    });
    await expect(generator().generateFullSeason(torneo.id, '2026-09-05')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

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
});
