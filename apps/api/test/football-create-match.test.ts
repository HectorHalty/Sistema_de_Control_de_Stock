import { describe, it, expect, vi } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FootballService } from '../src/football/football.service';
import type { PrismaService } from '../src/common/prisma.service';

/**
 * `POST /football/matches` es el único endpoint que sigue creando cruces
 * ahora que el generador de round-robin fue eliminado. Estas pruebas cubren
 * las validaciones agregadas a `FootballService.createMatch` para evitar
 * cruces inválidos o duplicados dentro de una misma jornada.
 */

function service(overrides: {
  jornada?: unknown;
  existingMatches?: unknown[];
  inscripciones?: unknown[];
} = {}) {
  const jornadaFindUnique = vi.fn().mockResolvedValue(overrides.jornada ?? null);
  const partidoFindMany = vi.fn().mockResolvedValue(overrides.existingMatches ?? []);
  const partidoCreate = vi.fn().mockResolvedValue({ id: 'm1' });
  const equipoInscripcionFindMany = vi.fn().mockResolvedValue(overrides.inscripciones ?? []);

  const prisma = {
    jornada: { findUnique: jornadaFindUnique },
    partidoFutbol: { findMany: partidoFindMany, create: partidoCreate },
    equipoInscripcion: { findMany: equipoInscripcionFindMany },
  } as unknown as PrismaService;

  const svc = new FootballService(
    prisma,
    undefined as any,
    undefined as any,
    undefined as any,
  );

  return { service: svc, jornadaFindUnique, partidoFindMany, partidoCreate, equipoInscripcionFindMany };
}

const baseData = {
  homeTeamId: 'team-home',
  awayTeamId: 'team-away',
  date: '2026-03-01T00:00:00.000Z',
};

describe('FootballService.createMatch', () => {
  it('rechaza cuando la inscripción local y visitante son la misma', async () => {
    const { service: svc, partidoCreate } = service();
    await expect(
      svc.createMatch({
        ...baseData,
        homeInscripcionId: 'insc-1',
        awayInscripcionId: 'insc-1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(partidoCreate).not.toHaveBeenCalled();
  });

  it('rechaza cuando la jornada no existe', async () => {
    const { service: svc, partidoCreate } = service({ jornada: null });
    await expect(
      svc.createMatch({ ...baseData, jornadaId: 'jornada-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(partidoCreate).not.toHaveBeenCalled();
  });

  it('rechaza cuando la jornada está suspendida', async () => {
    const { service: svc, partidoCreate } = service({
      jornada: { id: 'jornada-1', suspendida: true, torneoId: 'torneo-1' },
    });
    await expect(
      svc.createMatch({ ...baseData, jornadaId: 'jornada-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(partidoCreate).not.toHaveBeenCalled();
  });

  it('rechaza cuando un equipo ya tiene un cruce cargado en la jornada', async () => {
    const { service: svc, partidoCreate } = service({
      jornada: { id: 'jornada-1', suspendida: false, torneoId: 'torneo-1' },
      existingMatches: [{ id: 'existing-match' }],
    });
    await expect(
      svc.createMatch({
        ...baseData,
        jornadaId: 'jornada-1',
        homeInscripcionId: 'insc-1',
        awayInscripcionId: 'insc-2',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(partidoCreate).not.toHaveBeenCalled();
  });

  it('rechaza cuando una inscripción no pertenece al torneo de la jornada', async () => {
    const { service: svc, partidoCreate } = service({
      jornada: { id: 'jornada-1', suspendida: false, torneoId: 'torneo-1' },
      existingMatches: [],
      inscripciones: [{ id: 'insc-1' }],
    });
    await expect(
      svc.createMatch({
        ...baseData,
        jornadaId: 'jornada-1',
        homeInscripcionId: 'insc-1',
        awayInscripcionId: 'insc-2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(partidoCreate).not.toHaveBeenCalled();
  });

  it('crea el cruce cuando todas las validaciones pasan', async () => {
    const { service: svc, partidoCreate } = service({
      jornada: { id: 'jornada-1', suspendida: false, torneoId: 'torneo-1' },
      existingMatches: [],
      inscripciones: [{ id: 'insc-1' }, { id: 'insc-2' }],
    });
    await svc.createMatch({
      ...baseData,
      jornadaId: 'jornada-1',
      homeInscripcionId: 'insc-1',
      awayInscripcionId: 'insc-2',
    });
    expect(partidoCreate).toHaveBeenCalledOnce();
  });
});
