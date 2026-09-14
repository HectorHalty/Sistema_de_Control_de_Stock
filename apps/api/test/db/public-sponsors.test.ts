import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PublicService } from '../../src/public/public.service';
import { SponsorsService } from '../../src/sponsors/sponsors.service';
import { CreateSponsorDto } from '../../src/sponsors/dto/sponsor.dto';
import { testPrisma, resetTestDb } from './helpers/db';
import type { PrismaService } from '../../src/common/prisma.service';
import type { ReglamentoEngineService } from '../../src/reglamento/reglamento-engine.service';

const prisma = testPrisma();
const publicService = new PublicService(
  prisma as unknown as PrismaService,
  {} as unknown as ReglamentoEngineService,
);
const sponsors = new SponsorsService(prisma as unknown as PrismaService);

describe('sponsors públicos (Postgres real)', () => {
  beforeEach(async () => {
    await resetTestDb();
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('listSponsors no devuelve sidebar, footer ni inactivos', async () => {
    await prisma.patrocinador.create({ data: { name: 'Home A', imageUrl: '/a', placement: 'home' } });
    await prisma.patrocinador.create({
      data: { name: 'Cantina A', imageUrl: '/b', placement: 'cantina' },
    });
    await prisma.patrocinador.create({ data: { name: 'Side', imageUrl: '/c', placement: 'sidebar' } });
    await prisma.patrocinador.create({ data: { name: 'Foot', imageUrl: '/d', placement: 'footer' } });
    await prisma.patrocinador.create({
      data: { name: 'Home Off', imageUrl: '/e', placement: 'home', active: false },
    });

    const rows = await publicService.listSponsors();
    expect(rows.map((r) => r.name).sort()).toEqual(['Cantina A', 'Home A']);
    expect(rows[0]).toHaveProperty('durationSeconds');
  });

  it('crear un sponsor con durationSeconds fuera de 2–60 falla la validación del DTO', async () => {
    const dto = plainToInstance(CreateSponsorDto, {
      name: 'X',
      imageUrl: '/x',
      placement: 'home',
      durationSeconds: 61,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('el service default-ea durationSeconds a 5', async () => {
    const created = await sponsors.create({ name: 'Y', imageUrl: '/y', placement: 'home' });
    expect(created.durationSeconds).toBe(5);
  });
});
