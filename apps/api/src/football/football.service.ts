import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReglamentoEngineService } from '../reglamento/reglamento-engine.service';
import { autoScheduleMatches } from './fixture-scheduler';
import { scheduleSaturdayMatches } from './saturday-scheduler';
import { SuspensionSyncService } from './suspension-sync.service';

@Injectable()
export class FootballService {
  constructor(
    private prisma: PrismaService,
    private reglamentoEngine: ReglamentoEngineService,
    private suspensionSync: SuspensionSyncService,
  ) {}

  async getOverview(torneoId?: string) {
    const torneo = torneoId
      ? await this.prisma.torneo.findUnique({
          where: { id: torneoId },
          include: {
            categoria: true,
            campeonato: { include: { temporada: true } },
          },
        })
      : await this.getActiveTorneo();

    const torneos = await this.listTorneos();

    if (!torneo) {
      return { torneo: null, stats: null, torneos };
    }

    const [equipos, partidos, capitanes, jornadas] = await Promise.all([
      this.prisma.equipoInscripcion.count({ where: { torneoId: torneo.id, activo: true } }),
      this.prisma.partidoFutbol.count({ where: { torneoId: torneo.id } }),
      this.prisma.capitanAutorizado.count({ where: { torneoId: torneo.id, activo: true } }),
      this.prisma.jornada.count({ where: { torneoId: torneo.id } }),
    ]);

    return {
      torneo,
      stats: { equipos, partidos, capitanes, jornadas },
      torneos,
    };
  }

  async getActiveTorneo() {
    return this.prisma.torneo.findFirst({
      where: { activo: true },
      include: {
        categoria: true,
        campeonato: { include: { temporada: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async listTorneos() {
    return this.prisma.torneo.findMany({
      include: {
        categoria: true,
        campeonato: { include: { temporada: true } },
      },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
    });
  }

  async createTorneo(data: { campeonatoId: string; categoriaId: string; nombre?: string }) {
    const [campeonato, categoria] = await Promise.all([
      this.prisma.campeonato.findUnique({ where: { id: data.campeonatoId } }),
      this.prisma.categoriaConfig.findUnique({ where: { id: data.categoriaId } }),
    ]);
    if (!campeonato) throw new NotFoundException('Campeonato no encontrado');
    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    const existing = await this.prisma.torneo.findUnique({
      where: {
        campeonatoId_categoriaId: {
          campeonatoId: data.campeonatoId,
          categoriaId: data.categoriaId,
        },
      },
    });
    if (existing) throw new ConflictException('Ya existe un torneo para esta categoría en el campeonato');

    const torneo = await this.prisma.torneo.create({
      data: {
        campeonatoId: data.campeonatoId,
        categoriaId: data.categoriaId,
        nombre: data.nombre ?? `${categoria.nombre} — ${campeonato.nombre}`,
        activo: true,
        publicado: false,
      },
      include: {
        categoria: true,
        campeonato: { include: { temporada: true } },
      },
    });

    await this.prisma.torneoConfig.create({ data: { torneoId: torneo.id } });
    return torneo;
  }

  async bootstrapTorneosCampeonato(campeonatoId?: string) {
    const campeonato = campeonatoId
      ? await this.prisma.campeonato.findUnique({ where: { id: campeonatoId } })
      : await this.prisma.campeonato.findFirst({ where: { activo: true } });
    if (!campeonato) throw new BadRequestException('No hay campeonato activo');

    const categorias = await this.prisma.categoriaConfig.findMany({ orderBy: { nombre: 'asc' } });
    const created: string[] = [];

    for (const cat of categorias) {
      const torneo = await this.prisma.torneo.upsert({
        where: {
          campeonatoId_categoriaId: { campeonatoId: campeonato.id, categoriaId: cat.id },
        },
        update: { activo: true },
        create: {
          campeonatoId: campeonato.id,
          categoriaId: cat.id,
          nombre: `${cat.nombre} — ${campeonato.nombre}`,
          activo: true,
          publicado: false,
        },
        include: { categoria: true },
      });
      await this.prisma.torneoConfig.upsert({
        where: { torneoId: torneo.id },
        update: {},
        create: { torneoId: torneo.id },
      });
      created.push(torneo.categoria.nombre);
    }

    return { campeonatoId: campeonato.id, created: created.length, categorias: created };
  }

  async updateTorneo(
    id: string,
    data: { publicado?: boolean; activo?: boolean; nombre?: string },
  ) {
    const torneo = await this.prisma.torneo.findUnique({ where: { id } });
    if (!torneo) throw new NotFoundException('Torneo no encontrado');
    return this.prisma.torneo.update({
      where: { id },
      data,
      include: {
        categoria: true,
        campeonato: { include: { temporada: true } },
      },
    });
  }

  async listCategorias() {
    return this.prisma.categoriaConfig.findMany({ orderBy: { nombre: 'asc' } });
  }

  async listCanchas() {
    return this.prisma.cancha.findMany({
      where: { activa: true },
      include: { grupoCanchas: true },
      orderBy: [{ grupoCanchas: { codigo: 'asc' } }, { numero: 'asc' }],
    });
  }

  // Teams (legacy + inscripciones)
  async findAllTeams() {
    return this.prisma.equipoFutbol.findMany({ orderBy: { name: 'asc' } });
  }

  async createTeam(data: { name: string; shortName?: string; logo?: string; color?: string }) {
    return this.prisma.equipoFutbol.create({ data });
  }

  async listInscriptions(torneoId?: string) {
    const active = torneoId ? { torneoId } : await this.resolveTorneoId();
    return this.prisma.equipoInscripcion.findMany({
      where: active,
      include: {
        equipo: true,
        torneo: { include: { categoria: true } },
        _count: { select: { jugadores: { where: { activa: true } } } },
      },
      orderBy: { equipo: { name: 'asc' } },
    });
  }

  async createInscription(data: {
    torneoId: string;
    equipoId?: string;
    name?: string;
    shortName?: string;
    color?: string;
    abbr?: string;
  }) {
    let equipoId = data.equipoId;
    if (!equipoId && data.name) {
      const equipo = await this.prisma.equipoFutbol.create({
        data: {
          name: data.name,
          shortName: data.shortName,
          color: data.color,
        },
      });
      equipoId = equipo.id;
    }
    if (!equipoId) {
      throw new BadRequestException('equipoId o name requerido');
    }

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
    } catch {
      throw new ConflictException('El equipo ya está inscripto en este torneo');
    }
  }

  async updateInscription(
    id: string,
    data: { abbr?: string; color?: string; activo?: boolean; descuentoPuntosWO?: number },
  ) {
    return this.prisma.equipoInscripcion.update({
      where: { id },
      data,
      include: { equipo: true, torneo: { include: { categoria: true } } },
    });
  }

  async listCaptains(torneoId?: string) {
    const where = torneoId ? { torneoId } : await this.resolveTorneoId();
    return this.prisma.capitanAutorizado.findMany({
      where,
      include: {
        equipoInscripcion: { include: { equipo: true } },
        torneo: { include: { categoria: true } },
      },
      orderBy: { email: 'asc' },
    });
  }

  async createCaptain(data: {
    email: string;
    dni: string;
    torneoId: string;
    equipoInscripcionId: string;
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
    } catch {
      throw new ConflictException('Email o DNI ya registrado en este torneo');
    }
  }

  async updateCaptain(id: string, data: { email?: string; dni?: string; activo?: boolean }) {
    const payload = { ...data };
    if (payload.dni) payload.dni = payload.dni.replace(/\D/g, '');
    return this.prisma.capitanAutorizado.update({
      where: { id },
      data: payload,
      include: {
        equipoInscripcion: { include: { equipo: true } },
        torneo: { include: { categoria: true } },
      },
    });
  }

  async deleteCaptain(id: string) {
    await this.prisma.capitanAutorizado.delete({ where: { id } });
    return { ok: true };
  }

  async getRoster(inscripcionId: string) {
    const inscripcion = await this.prisma.equipoInscripcion.findUnique({
      where: { id: inscripcionId },
      include: {
        equipo: true,
        torneo: { include: { categoria: true, campeonato: true } },
      },
    });
    if (!inscripcion) throw new NotFoundException('Inscripción no encontrada');

    const jugadores = await this.prisma.inscripcionJugador.findMany({
      where: { equipoInscripcionId: inscripcionId, activa: true },
      include: { persona: true },
      orderBy: [{ rolPlantel: 'asc' }, { persona: { apellido: 'asc' } }],
    });

    return {
      inscripcion,
      jugadores: jugadores.map((j) => ({
        id: j.id,
        personaId: j.personaId,
        nombre: j.persona.nombre,
        apellido: j.persona.apellido,
        dni: j.persona.dni,
        email: j.persona.email,
        fechaNacimiento: j.persona.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
        numeroCamiseta: j.numeroCamiseta,
        rolPlantel: j.rolPlantel,
      })),
    };
  }

  async getListaBuenaFeHtml(inscripcionId: string) {
    const { inscripcion, jugadores } = await this.getRoster(inscripcionId);
    const proximo = await this.prisma.partidoFutbol.findFirst({
      where: {
        torneoId: inscripcion.torneoId,
        status: 'pendiente',
        OR: [
          { homeInscripcionId: inscripcionId },
          { awayInscripcionId: inscripcionId },
        ],
      },
      include: { homeTeam: true, awayTeam: true, cancha: true },
      orderBy: { date: 'asc' },
    });

    const eq = inscripcion.equipo;
    const rows = jugadores
      .map(
        (p, i) =>
          `<tr><td>${i + 1}</td><td>${p.apellido}, ${p.nombre}</td><td>${p.dni}</td><td>${p.email ?? ''}</td><td>${p.fechaNacimiento ?? ''}</td></tr>`,
      )
      .join('');

    const partidoBlock = proximo
      ? `<p><strong>Próximo partido:</strong> ${proximo.date.toLocaleDateString('es-AR')} ${proximo.horaInicio ?? ''} — ${proximo.cancha ? `Cancha ${proximo.cancha.numero}` : (proximo.venue ?? '')} vs ${proximo.homeInscripcionId === inscripcionId ? proximo.awayTeam.name : proximo.homeTeam.name}</p>`
      : '';

    return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Lista de Buena Fe — ${eq.name}</title>
<style>body{font-family:sans-serif;padding:24px;color:#111}h1{color:#2d6a4f}table{border-collapse:collapse;width:100%;margin-top:16px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#e8f5e9}</style></head>
<body><h1>Lista de Buena Fe</h1>
<p><strong>Equipo:</strong> ${eq.name} · <strong>Categoría:</strong> ${inscripcion.torneo.categoria.nombre} · <strong>Torneo:</strong> ${inscripcion.torneo.nombre}</p>
${partidoBlock}
<table><thead><tr><th>#</th><th>Jugador</th><th>DNI</th><th>Email</th><th>Nacimiento</th></tr></thead><tbody>${rows}</tbody></table>
<script>window.onload=()=>window.print()</script></body></html>`;
  }

  async listJornadas(torneoId?: string) {
    const where = torneoId ? { torneoId } : await this.resolveTorneoId();
    return this.prisma.jornada.findMany({
      where,
      include: { _count: { select: { partidos: true } } },
      orderBy: { numero: 'asc' },
    });
  }

  async createJornada(data: { torneoId: string; numero: number; fecha: string }) {
    return this.prisma.jornada.create({
      data: {
        torneoId: data.torneoId,
        numero: data.numero,
        fecha: new Date(data.fecha),
      },
    });
  }

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
    const pairs = this.buildRoundPairs(inscripciones, roundIndex);
    const created: Awaited<ReturnType<typeof this.prisma.partidoFutbol.create>>[] = [];

    for (const [home, away] of pairs) {
      const matchDate = new Date(jornada.fecha);
      const partido = await this.prisma.partidoFutbol.create({
        data: {
          torneoId: jornada.torneoId,
          jornadaId: jornada.id,
          homeTeamId: home.equipoId,
          awayTeamId: away.equipoId,
          homeInscripcionId: home.id,
          awayInscripcionId: away.id,
          date: matchDate,
          status: 'pendiente',
        },
        include: this.matchInclude(),
      });
      created.push(partido);
    }

    return { jornadaId, created: created.length, matches: created };
  }

  // Matches
  async findAllMatches(filters?: { status?: string; torneoId?: string; jornadaId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status;
    if (filters?.torneoId) where.torneoId = filters.torneoId;
    if (filters?.jornadaId) where.jornadaId = filters.jornadaId;

    return this.prisma.partidoFutbol.findMany({
      where,
      include: this.matchInclude(),
      orderBy: [{ date: 'asc' }, { horaInicio: 'asc' }],
    });
  }

  async createMatch(data: {
    homeTeamId: string;
    awayTeamId: string;
    date: string;
    venue?: string;
    torneoId?: string;
    jornadaId?: string;
    homeInscripcionId?: string;
    awayInscripcionId?: string;
    canchaId?: string;
    horaInicio?: string;
  }) {
    return this.prisma.partidoFutbol.create({
      data: {
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        date: new Date(data.date),
        venue: data.venue,
        torneoId: data.torneoId,
        jornadaId: data.jornadaId,
        homeInscripcionId: data.homeInscripcionId,
        awayInscripcionId: data.awayInscripcionId,
        canchaId: data.canchaId,
        horaInicio: data.horaInicio,
        status: 'pendiente',
      },
      include: this.matchInclude(),
    });
  }

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

  private dayRange(fecha: string) {
    const dayStart = new Date(fecha);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    return { dayStart, dayEnd };
  }

  async getSaturdayGrid(fecha: string, campeonatoId?: string) {
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

    const [matches, canchas] = await Promise.all([
      this.prisma.partidoFutbol.findMany({
        where: {
          torneoId: { in: torneoIds },
          date: { gte: dayStart, lt: dayEnd },
          canchaId: { not: null },
          horaInicio: { not: null },
        },
        include: {
          homeTeam: true,
          awayTeam: true,
          cancha: { include: { grupoCanchas: true } },
          torneo: { include: { categoria: true } },
          jornada: true,
        },
        orderBy: [{ horaInicio: 'asc' }, { cancha: { numero: 'asc' } }],
      }),
      this.prisma.cancha.findMany({
        where: { activa: true, numero: { lte: 8 } },
        include: { grupoCanchas: true },
        orderBy: { numero: 'asc' },
      }),
    ]);

    return {
      fecha,
      campeonato: campeonato.nombre,
      canchas,
      partidos: matches.map((m) => ({
        id: m.id,
        hora: m.horaInicio,
        canchaId: m.canchaId,
        canchaNumero: m.cancha?.numero,
        categoria: m.torneo?.categoria.nombre,
        categoriaColor: m.torneo?.categoria.colorHex,
        local: m.homeTeam.name,
        visitante: m.awayTeam.name,
        bloqueadoManual: m.bloqueadoManual,
        jornada: m.jornada?.numero ?? null,
      })),
    };
  }

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

  async suspendJornadaPorLluvia(jornadaId: string) {
    const jornada = await this.prisma.jornada.findUnique({
      where: { id: jornadaId },
      include: { torneo: true },
    });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada.suspendida) {
      throw new ConflictException('La jornada ya está suspendida');
    }

    const pendingMatches = await this.prisma.partidoFutbol.findMany({
      where: { jornadaId, status: 'pendiente' },
    });

    const maxJornada = await this.prisma.jornada.findFirst({
      where: { torneoId: jornada.torneoId },
      orderBy: { numero: 'desc' },
    });
    const nextNumero = (maxJornada?.numero ?? jornada.numero) + 1;
    const recoveryDate = new Date(jornada.fecha);
    recoveryDate.setDate(recoveryDate.getDate() + 7);

    const recovery = await this.prisma.$transaction(async (tx) => {
      await tx.jornada.update({
        where: { id: jornadaId },
        data: { suspendida: true, publicada: false },
      });

      const nueva = await tx.jornada.create({
        data: {
          torneoId: jornada.torneoId,
          numero: nextNumero,
          fecha: recoveryDate,
          esRecuperacion: true,
          suspendida: false,
          publicada: false,
        },
      });

      for (const match of pendingMatches) {
        await tx.partidoFutbol.update({
          where: { id: match.id },
          data: {
            jornadaId: nueva.id,
            date: recoveryDate,
            ...(match.bloqueadoManual
              ? {}
              : { canchaId: null, horaInicio: null, venue: null }),
          },
        });
      }

      return nueva;
    });

    return {
      suspendedJornadaId: jornadaId,
      recoveryJornadaId: recovery.id,
      recoveryNumero: recovery.numero,
      recoveryFecha: recovery.fecha.toISOString(),
      movedMatches: pendingMatches.length,
    };
  }

  async publishJornada(jornadaId: string) {
    const jornada = await this.prisma.jornada.findUnique({ where: { id: jornadaId } });
    if (!jornada) throw new NotFoundException('Jornada no encontrada');
    if (jornada.suspendida) {
      throw new BadRequestException('No se puede publicar una jornada suspendida');
    }

    await this.prisma.jornada.update({
      where: { id: jornadaId },
      data: { publicada: true },
    });

    return { jornadaId, publicada: true };
  }

  async updateMatchSchedule(
    id: string,
    data: {
      canchaId?: string | null;
      horaInicio?: string | null;
      jornadaId?: string | null;
      bloqueadoManual?: boolean;
      venue?: string | null;
    },
  ) {
    const match = await this.prisma.partidoFutbol.findUnique({
      where: { id },
      include: { homeTeam: true, awayTeam: true },
    });
    if (!match) throw new NotFoundException(`Partido ${id} no encontrado`);

    let venue = data.venue;
    if (data.canchaId) {
      const cancha = await this.prisma.cancha.findUnique({ where: { id: data.canchaId } });
      if (cancha) venue = `Cancha ${cancha.numero}`;
    }

    const horaInicio = data.horaInicio ?? match.horaInicio;
    const warnings: string[] = [];

    if (horaInicio && match.torneoId) {
      const inscripcionIds = [match.homeInscripcionId, match.awayInscripcionId].filter(
        Boolean,
      ) as string[];

      for (const insId of inscripcionIds) {
        const prev = await this.prisma.partidoFutbol.findFirst({
          where: {
            torneoId: match.torneoId,
            id: { not: id },
            horaInicio,
            status: { in: ['jugado', 'pendiente'] },
            OR: [{ homeInscripcionId: insId }, { awayInscripcionId: insId }],
          },
          include: { jornada: true, homeTeam: true, awayTeam: true },
        });

        if (prev) {
          const teamName =
            prev.homeInscripcionId === insId ? prev.homeTeam.name : prev.awayTeam.name;
          warnings.push(
            `${teamName} ya tiene partido a las ${horaInicio} (J${prev.jornada?.numero ?? '?'})`,
          );
        }
      }
    }

    const updated = await this.prisma.partidoFutbol.update({
      where: { id },
      data: {
        canchaId: data.canchaId,
        horaInicio: data.horaInicio,
        jornadaId: data.jornadaId,
        bloqueadoManual: data.bloqueadoManual,
        venue: venue ?? undefined,
      },
      include: this.matchInclude(),
    });

    return { match: updated, warnings };
  }

  async updateMatchScore(
    id: string,
    homeGoals: number,
    awayGoals: number,
    events?: { personaId: string; tipo: string; minuto?: number }[],
  ) {
    const match = await this.prisma.partidoFutbol.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Partido ${id} no encontrado`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.partidoFutbol.update({
        where: { id },
        data: { homeGoals, awayGoals, status: 'jugado' },
        include: this.matchInclude(),
      });

      if (events?.length) {
        await tx.eventoPartido.deleteMany({ where: { partidoId: id } });
        await tx.eventoPartido.createMany({
          data: events.map((e) => ({
            partidoId: id,
            personaId: e.personaId,
            tipo: e.tipo,
            minuto: e.minuto,
          })),
        });
      }

      return row;
    });

    await this.suspensionSync.syncAfterEventChange(id);
    await this.suspensionSync.syncAfterMatchPlayed(id);

    return updated;
  }

  async listMatchEvents(partidoId: string) {
    return this.prisma.eventoPartido.findMany({
      where: { partidoId },
      include: { persona: true },
      orderBy: [{ minuto: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addMatchEvent(
    partidoId: string,
    data: { personaId: string; tipo: string; minuto?: number; articuloRef?: string },
  ) {
    const event = await this.prisma.eventoPartido.create({
      data: { partidoId, ...data },
      include: { persona: true },
    });
    await this.suspensionSync.syncAfterEventChange(partidoId);
    return event;
  }

  async deleteMatchEvent(eventId: string) {
    const event = await this.prisma.eventoPartido.findUnique({
      where: { id: eventId },
      select: { partidoId: true },
    });
    if (!event) throw new NotFoundException('Evento no encontrado');
    await this.prisma.eventoPartido.delete({ where: { id: eventId } });
    await this.suspensionSync.syncAfterEventChange(event.partidoId);
    return { ok: true };
  }

  async syncSuspensions(torneoId?: string) {
    const active = torneoId ?? (await this.getActiveTorneo())?.id;
    if (!active) throw new BadRequestException('No hay torneo activo');
    return this.suspensionSync.syncTorneo(active);
  }

  async getStandings(torneoId?: string) {
    const active = torneoId ?? (await this.getActiveTorneo())?.id;
    if (!active) return [];
    return this.reglamentoEngine.getStandingsForTorneo(active);
  }

  async listSuspensions(torneoId?: string) {
    const where: Record<string, unknown> = { activa: true };
    if (torneoId) where.torneoId = torneoId;
    return this.prisma.suspension.findMany({
      where,
      include: { persona: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async updateSuspension(
    id: string,
    data: { fechasRestantes?: number; activa?: boolean; motivo?: string },
  ) {
    return this.prisma.suspension.update({
      where: { id },
      data,
      include: { persona: true },
    });
  }

  async listReglamento() {
    const apartados = await this.prisma.reglamentoApartado.findMany({
      include: { articulos: { orderBy: { orden: 'asc' } } },
      orderBy: { orden: 'asc' },
    });
    const anexos = await this.prisma.reglamentoAnexo.findMany({ orderBy: { orden: 'asc' } });
    return { apartados, anexos };
  }

  async updateReglamentoArticulo(
    id: string,
    data: { titulo?: string; contenido?: string; aplicable?: boolean },
  ) {
    return this.prisma.reglamentoArticulo.update({ where: { id }, data });
  }

  private matchInclude() {
    return {
      homeTeam: true,
      awayTeam: true,
      cancha: { include: { grupoCanchas: true } },
      jornada: true,
      eventos: { include: { persona: true } },
    } as const;
  }

  private async resolveTorneoId(): Promise<{ torneoId: string }> {
    const torneo = await this.getActiveTorneo();
    if (!torneo) throw new BadRequestException('No hay torneo activo');
    return { torneoId: torneo.id };
  }

  private buildRoundPairs<T extends { id: string; equipoId: string }>(
    teams: T[],
    roundIndex: number,
  ): [T, T][] {
    const list = [...teams];
    if (list.length < 2) return [];

    if (list.length % 2 === 1) {
      list.push({ id: '__bye__', equipoId: '__bye__' } as T);
    }

    const rotated = [...list];
    for (let r = 0; r < roundIndex % (rotated.length - 1); r++) {
      const fixed = rotated[0];
      const tail = rotated.slice(1);
      const last = tail.pop()!;
      rotated.splice(0, rotated.length, fixed, last, ...tail);
    }

    const half = rotated.length / 2;
    const pairs: [T, T][] = [];
    for (let i = 0; i < half; i++) {
      const home = rotated[i];
      const away = rotated[rotated.length - 1 - i];
      if (home.id !== '__bye__' && away.id !== '__bye__') {
        pairs.push([home, away]);
      }
    }
    return pairs;
  }
}
