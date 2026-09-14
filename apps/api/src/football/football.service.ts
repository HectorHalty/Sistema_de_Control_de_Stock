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

@Injectable()
export class FootballService {
  constructor(
    private prisma: PrismaService,
    private reglamentoEngine: ReglamentoEngineService,
    private suspensionSync: SuspensionSyncService,
    private matchSuspension: MatchSuspensionService,
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

  async createCategoria(data: {
    codigo: string;
    nombre: string;
    genero: 'hombres' | 'mujeres';
    maxPlantel?: number;
    maxIncorporaciones?: number;
    minJugadoresInicio?: number;
    grupoCanchasId?: string;
    colorHex?: string;
  }) {
    const existing = await this.prisma.categoriaConfig.findUnique({ where: { codigo: data.codigo } });
    if (existing) throw new ConflictException(`Ya existe una categoría con código "${data.codigo}"`);

    return this.prisma.categoriaConfig.create({
      data: {
        codigo: data.codigo,
        nombre: data.nombre,
        genero: data.genero,
        maxPlantel: data.maxPlantel ?? 20,
        maxIncorporaciones: data.maxIncorporaciones ?? 3,
        minJugadoresInicio: data.minJugadoresInicio ?? 7,
        grupoCanchasId: data.grupoCanchasId,
        colorHex: data.colorHex,
      },
    });
  }

  async updateCategoria(
    id: string,
    data: {
      codigo?: string;
      nombre?: string;
      genero?: 'hombres' | 'mujeres';
      maxPlantel?: number;
      maxIncorporaciones?: number;
      minJugadoresInicio?: number;
      grupoCanchasId?: string | null;
      colorHex?: string | null;
    },
  ) {
    const existing = await this.prisma.categoriaConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Categoría no encontrada');

    if (data.codigo && data.codigo !== existing.codigo) {
      const dup = await this.prisma.categoriaConfig.findUnique({ where: { codigo: data.codigo } });
      if (dup) throw new ConflictException(`Ya existe una categoría con código "${data.codigo}"`);
    }

    return this.prisma.categoriaConfig.update({ where: { id }, data });
  }

  async deleteCategoria(id: string) {
    const existing = await this.prisma.categoriaConfig.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Categoría no encontrada');

    const torneosCount = await this.prisma.torneo.count({ where: { categoriaId: id } });
    if (torneosCount > 0) {
      throw new ConflictException('No se puede borrar una categoría que ya tiene torneos asociados');
    }

    await this.prisma.categoriaConfig.delete({ where: { id } });
    return { ok: true };
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

  async updateTeam(id: string, data: { name?: string; logo?: string }) {
    const existing = await this.prisma.equipoFutbol.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Equipo ${id} no encontrado`);
    if (data.name && data.name !== existing.name) {
      const dup = await this.prisma.equipoFutbol.findUnique({ where: { name: data.name } });
      if (dup) throw new ConflictException(`Ya existe un equipo llamado "${data.name}"`);
    }
    return this.prisma.equipoFutbol.update({ where: { id }, data });
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
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException('El equipo ya está inscripto en este torneo');
      }
      throw e;
    }
  }

  async updateInscription(
    id: string,
    data: {
      abbr?: string;
      color?: string;
      activo?: boolean;
      descuentoPuntosWO?: number;
      torneoId?: string;
    },
  ) {
    const existing = await this.prisma.equipoInscripcion.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Inscripción ${id} no encontrada`);

    const { torneoId, ...rest } = data;

    if (torneoId && torneoId !== existing.torneoId) {
      const torneo = await this.prisma.torneo.findUnique({ where: { id: torneoId } });
      if (!torneo) throw new NotFoundException('Torneo destino no encontrado');

      const conflicto = await this.prisma.equipoInscripcion.findUnique({
        where: { torneoId_equipoId: { torneoId, equipoId: existing.equipoId } },
      });
      if (conflicto) {
        throw new ConflictException('Este equipo ya está inscripto en el torneo destino');
      }
    }

    return this.prisma.equipoInscripcion.update({
      where: { id },
      data: { ...rest, ...(torneoId ? { torneoId } : {}) },
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
    } catch (e) {
      if (isPrismaUniqueConflict(e)) {
        throw new ConflictException('Email o DNI ya registrado en este torneo');
      }
      throw e;
    }
  }

  async updateCaptain(id: string, data: { email?: string; dni?: string; activo?: boolean }) {
    const existing = await this.prisma.capitanAutorizado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Capitán ${id} no encontrado`);
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
    const existing = await this.prisma.capitanAutorizado.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Capitán ${id} no encontrado`);
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

    const jugadoresMapeados = jugadores.map((j) => ({
      id: j.id,
      personaId: j.personaId,
      nombre: j.persona.nombre,
      apellido: j.persona.apellido,
      dni: j.persona.dni,
      email: j.persona.email,
      fechaNacimiento: j.persona.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
      numeroCamiseta: j.numeroCamiseta,
      rolPlantel: j.rolPlantel,
    }));

    // Capitán del plantel: si hay capitán y subcapitán, se prioriza el capitán
    // como principal. Se devuelve a partir de la misma lista ya cargada
    // (sin query adicional) para no duplicar el filtro por rolPlantel.
    const capitan =
      jugadoresMapeados.find((j) => j.rolPlantel === 'capitan') ??
      jugadoresMapeados.find((j) => j.rolPlantel === 'subcapitan') ??
      null;

    return {
      inscripcion,
      jugadores: jugadoresMapeados,
      capitan,
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

  // Matches
  async findAllMatches(filters?: { status?: string; torneoId?: string; jornadaId?: string }) {
    const where: Record<string, unknown> = {};
    if (filters?.status) where.status = filters.status as EstadoPartido;
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
        genero: m.torneo?.categoria.genero,
        local: m.homeTeam.name,
        visitante: m.awayTeam.name,
        bloqueadoManual: m.bloqueadoManual,
        jornada: m.jornada?.numero ?? null,
      })),
    };
  }

  async suspendJornadaPorLluvia(jornadaId: string) {
    return this.matchSuspension.suspendJornadaPorLluvia(jornadaId);
  }

  async suspendMatch(matchId: string) {
    return this.matchSuspension.suspendMatch(matchId);
  }

  async suspendSaturday(fecha: string) {
    return this.matchSuspension.suspendSaturday(fecha);
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

    let venue: string | null | undefined = data.venue;
    if (data.canchaId) {
      const cancha = await this.prisma.cancha.findUnique({ where: { id: data.canchaId } });
      if (cancha) venue = `Cancha ${cancha.numero}`;
    }
    if (data.canchaId === null && data.venue === undefined) {
      venue = null;
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
        venue: venue === undefined ? undefined : venue,
      },
      include: this.matchInclude(),
    });

    return { match: updated, warnings };
  }

  async updateMatchScore(
    id: string,
    homeGoals: number,
    awayGoals: number,
    events?: { personaId: string; tipo: TipoEventoPartido; minuto?: number }[],
  ) {
    const match = await this.prisma.partidoFutbol.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Partido ${id} no encontrado`);

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.partidoFutbol.update({
        where: { id },
        data: { homeGoals, awayGoals, status: 'jugado' },
        include: this.matchInclude(),
      });

      if (events !== undefined) {
        await tx.eventoPartido.deleteMany({ where: { partidoId: id } });
        if (events.length) {
          await tx.eventoPartido.createMany({
            data: events.map((e) => ({
              partidoId: id,
              personaId: e.personaId,
              tipo: e.tipo,
              minuto: e.minuto,
            })),
          });
        }
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
    data: { personaId: string; tipo: TipoEventoPartido; minuto?: number; articuloRef?: string },
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
    const existing = await this.prisma.suspension.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Suspensión ${id} no encontrada`);

    const updateData: typeof data & {
      ajustadoManualmente?: boolean;
      pendienteDefinir?: boolean;
    } = { ...data };

    if (data.fechasRestantes !== undefined) {
      // El admin completa/ajusta el valor a mano: no debe pisarse en la próxima
      // sincronización automática desde eventos.
      updateData.ajustadoManualmente = true;
      updateData.pendienteDefinir = false;
    }

    return this.prisma.suspension.update({
      where: { id },
      data: updateData,
      include: { persona: true },
    });
  }

  async getPlanillasForFecha(fecha: string) {
    const { dayStart, dayEnd } = this.dayRange(fecha);

    const matches = await this.prisma.partidoFutbol.findMany({
      where: {
        jornada: { fecha: { gte: dayStart, lt: dayEnd } },
        status: { not: 'suspendido' },
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        cancha: true,
        torneo: { include: { categoria: true, campeonato: true } },
        homeInscripcion: {
          include: {
            jugadores: {
              where: { activa: true },
              include: { persona: true },
            },
          },
        },
        awayInscripcion: {
          include: {
            jugadores: {
              where: { activa: true },
              include: { persona: true },
            },
          },
        },
      },
      orderBy: [{ horaInicio: 'asc' }],
    });

    type RosterInscripcion = (typeof matches)[number]['homeInscripcion'];

    const buildRoster = (inscripcion: RosterInscripcion) =>
      (inscripcion?.jugadores ?? []).map((j) => ({
        personaId: j.persona.id,
        nombre: j.persona.nombre,
        apellido: j.persona.apellido,
        dni: j.persona.dni,
        fechaNacimiento: j.persona.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
        numeroCamiseta: j.numeroCamiseta,
      }));

    type PlanillaCategoria = {
      categoriaId: string;
      categoriaNombre: string;
      genero: string;
      torneoId: string;
      campeonatoNombre: string;
      matches: Array<{
        matchId: string;
        canchaNumero: number | null;
        horaInicio: string | null;
        home: {
          inscripcionId: string;
          equipoNombre: string;
          abbr: string | null;
          roster: ReturnType<typeof buildRoster>;
        };
        away: {
          inscripcionId: string;
          equipoNombre: string;
          abbr: string | null;
          roster: ReturnType<typeof buildRoster>;
        };
      }>;
    };

    const categoriasMap = new Map<string, PlanillaCategoria>();

    for (const m of matches) {
      if (!m.torneo) continue;
      const categoria = m.torneo.categoria;

      let entry = categoriasMap.get(categoria.id);
      if (!entry) {
        entry = {
          categoriaId: categoria.id,
          categoriaNombre: categoria.nombre,
          genero: categoria.genero,
          torneoId: m.torneo.id,
          campeonatoNombre: m.torneo.campeonato.nombre,
          matches: [],
        };
        categoriasMap.set(categoria.id, entry);
      }

      entry.matches.push({
        matchId: m.id,
        canchaNumero: m.cancha?.numero ?? null,
        horaInicio: m.horaInicio,
        home: {
          inscripcionId: m.homeInscripcionId ?? '',
          equipoNombre: m.homeTeam.name,
          abbr: m.homeInscripcion?.abbr ?? null,
          roster: buildRoster(m.homeInscripcion),
        },
        away: {
          inscripcionId: m.awayInscripcionId ?? '',
          equipoNombre: m.awayTeam.name,
          abbr: m.awayInscripcion?.abbr ?? null,
          roster: buildRoster(m.awayInscripcion),
        },
      });
    }

    return {
      fecha,
      categorias: [...categoriasMap.values()],
    };
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
    const existing = await this.prisma.reglamentoArticulo.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Artículo ${id} no encontrado`);
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
}
