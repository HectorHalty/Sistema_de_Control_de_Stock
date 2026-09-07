import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { testPrisma, resetTestDb } from './helpers/db';

const prisma = testPrisma();

async function seedTorneo() {
  const temporada = await prisma.temporada.create({
    data: { nombre: '2026', anio: 2026, inicio: new Date(), fin: new Date() },
  });
  const campeonato = await prisma.campeonato.create({
    data: { temporadaId: temporada.id, nombre: 'Apertura' },
  });
  const categoria = await prisma.categoriaConfig.create({
    data: {
      codigo: 'hombres_libre_a',
      nombre: 'Libre A',
      genero: 'hombres',
      maxPlantel: 18,
      minJugadoresInicio: 7,
    },
  });
  const torneo = await prisma.torneo.create({
    data: { campeonatoId: campeonato.id, categoriaId: categoria.id, nombre: 'Libre A' },
  });
  const equipo = await prisma.equipoFutbol.create({ data: { name: 'Los Pibes' } });
  const inscripcion = await prisma.equipoInscripcion.create({
    data: { torneoId: torneo.id, equipoId: equipo.id },
  });
  return { torneo, equipo, inscripcion };
}

describe('restricciones de fútbol', () => {
  beforeEach(async () => {
    await resetTestDb();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rechaza dos personas con el mismo email', async () => {
    await prisma.persona.create({
      data: { dni: '30111222', nombre: 'A', apellido: 'A', email: 'dup@lch.test' },
    });
    await expect(
      prisma.persona.create({
        data: { dni: '30111223', nombre: 'B', apellido: 'B', email: 'dup@lch.test' },
      }),
    ).rejects.toThrow();
  });

  it('permite varias personas sin email', async () => {
    await prisma.persona.create({ data: { dni: '30111224', nombre: 'C', apellido: 'C' } });
    const segunda = await prisma.persona.create({
      data: { dni: '30111225', nombre: 'D', apellido: 'D' },
    });
    expect(segunda.email).toBeNull();
  });

  it('rechaza dos jugadores con la misma camiseta en el mismo equipo', async () => {
    const { torneo, inscripcion } = await seedTorneo();
    const p1 = await prisma.persona.create({ data: { dni: '40000001', nombre: 'E', apellido: 'E' } });
    const p2 = await prisma.persona.create({ data: { dni: '40000002', nombre: 'F', apellido: 'F' } });
    await prisma.inscripcionJugador.create({
      data: {
        personaId: p1.id,
        torneoId: torneo.id,
        equipoInscripcionId: inscripcion.id,
        numeroCamiseta: 10,
      },
    });
    await expect(
      prisma.inscripcionJugador.create({
        data: {
          personaId: p2.id,
          torneoId: torneo.id,
          equipoInscripcionId: inscripcion.id,
          numeroCamiseta: 10,
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza una cuenta pública sin ningún método de autenticación', async () => {
    await expect(
      prisma.cuentaPublica.create({ data: { email: 'sinauth@lch.test' } }),
    ).rejects.toThrow();
  });

  it('acepta una cuenta pública con solo googleId', async () => {
    const cuenta = await prisma.cuentaPublica.create({
      data: { email: 'google@lch.test', googleId: 'g-123' },
    });
    expect(cuenta.googleId).toBe('g-123');
  });

  it('rechaza un estado de partido inventado', async () => {
    const { torneo, equipo } = await seedTorneo();
    const rival = await prisma.equipoFutbol.create({ data: { name: 'Rival' } });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "partidos_futbol" ("id", "homeTeamId", "awayTeamId", "date", "status", "torneoId", "updatedAt")
         VALUES (gen_random_uuid()::text, $1, $2, now(), 'aplazado', $3, now())`,
        equipo.id,
        rival.id,
        torneo.id,
      ),
    ).rejects.toThrow();
  });

  it('rechaza goles negativos', async () => {
    const { torneo, equipo } = await seedTorneo();
    const rival = await prisma.equipoFutbol.create({ data: { name: 'Rival2' } });
    await expect(
      prisma.partidoFutbol.create({
        data: {
          homeTeamId: equipo.id,
          awayTeamId: rival.id,
          date: new Date(),
          torneoId: torneo.id,
          homeGoals: -1,
          awayGoals: 0,
        },
      }),
    ).rejects.toThrow();
  });

  it('rechaza un tipo de evento inventado', async () => {
    const { torneo, equipo } = await seedTorneo();
    const rival = await prisma.equipoFutbol.create({ data: { name: 'Rival3' } });
    const persona = await prisma.persona.create({
      data: { dni: '40000003', nombre: 'G', apellido: 'G' },
    });
    const partido = await prisma.partidoFutbol.create({
      data: { homeTeamId: equipo.id, awayTeamId: rival.id, date: new Date(), torneoId: torneo.id },
    });
    await expect(
      prisma.$executeRawUnsafe(
        `INSERT INTO "eventos_partido" ("id", "partidoId", "personaId", "tipo")
         VALUES (gen_random_uuid()::text, $1, $2, 'penal_errado')`,
        partido.id,
        persona.id,
      ),
    ).rejects.toThrow();
  });

  it('rechaza una suspensión originada en un partido que no existe', async () => {
    const persona = await prisma.persona.create({
      data: { dni: '40000004', nombre: 'H', apellido: 'H' },
    });
    await expect(
      prisma.suspension.create({
        data: {
          personaId: persona.id,
          motivo: 'roja',
          origenPartidoId: '00000000-0000-4000-8000-000000000099',
        },
      }),
    ).rejects.toThrow();
  });
});
