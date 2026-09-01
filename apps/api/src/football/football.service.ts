import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReglamentoEngineService } from '../reglamento/reglamento-engine.service';
import { autoScheduleMatches } from './fixture-scheduler';

@Injectable()
export class FootballService {
  constructor(
    private prisma: PrismaService,
    private reglamentoEngine: ReglamentoEngineService,
  ) {}

  async getOverview() {
    const torneo = await this.getActiveTorneo();
    if (!torneo) {
      return { torneo: null, stats: null };
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
      include: { categoria: true, campeonato: true },
      orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
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

    const [canchas, franjas, matches, sameDayMatches] = await Promise.all([
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
    const match = await this.prisma.partidoFutbol.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Partido ${id} no encontrado`);

    let venue = data.venue;
    if (data.canchaId) {
      const cancha = await this.prisma.cancha.findUnique({ where: { id: data.canchaId } });
      if (cancha) venue = `Cancha ${cancha.numero}`;
    }

    return this.prisma.partidoFutbol.update({
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
  }

  async updateMatchScore(
    id: string,
    homeGoals: number,
    awayGoals: number,
    events?: { personaId: string; tipo: string; minuto?: number }[],
  ) {
    const match = await this.prisma.partidoFutbol.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Partido ${id} no encontrado`);

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.partidoFutbol.update({
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

      return updated;
    });
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
    return this.prisma.eventoPartido.create({
      data: { partidoId, ...data },
      include: { persona: true },
    });
  }

  async deleteMatchEvent(eventId: string) {
    await this.prisma.eventoPartido.delete({ where: { id: eventId } });
    return { ok: true };
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
