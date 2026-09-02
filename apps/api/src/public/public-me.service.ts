import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { PublicAuthService } from './public-auth.service';
import { ReglamentoEngineService } from '../reglamento/reglamento-engine.service';
import { FootballService } from '../football/football.service';
import type { RosterPlayerDto } from './dto/public-auth.dto';

@Injectable()
export class PublicMeService {
  constructor(
    private prisma: PrismaService,
    private auth: PublicAuthService,
    private reglamentoEngine: ReglamentoEngineService,
  ) {}

  async listTeams(search?: string, torneoId?: string) {
    const torneo = torneoId
      ? await this.prisma.torneo.findUnique({ where: { id: torneoId } })
      : await this.prisma.torneo.findFirst({
          where: { activo: true, publicado: true },
          orderBy: { updatedAt: 'desc' },
        });

    if (!torneo) return [];

    const inscripciones = await this.prisma.equipoInscripcion.findMany({
      where: {
        torneoId: torneo.id,
        activo: true,
        ...(search
          ? { equipo: { name: { contains: search, mode: 'insensitive' as const } } }
          : {}),
      },
      include: { equipo: true, torneo: { include: { categoria: true } } },
      orderBy: { equipo: { name: 'asc' } },
      take: 50,
    });

    return inscripciones.map((i) => ({
      equipoInscripcionId: i.id,
      name: i.equipo.name,
      shortName: i.abbr ?? i.equipo.shortName,
      color: i.color ?? i.equipo.color,
      categoria: i.torneo.categoria.nombre,
      torneoId: i.torneoId,
    }));
  }

  async followTeam(cuentaId: string, equipoInscripcionId: string) {
    const cuenta = await this.prisma.cuentaPublica.findUniqueOrThrow({
      where: { id: cuentaId },
    });

    if (cuenta.rol === 'jugador' || cuenta.rol === 'capitan') {
      throw new ConflictException('Los jugadores y capitanes no pueden seguir equipos');
    }

    const inscripcion = await this.prisma.equipoInscripcion.findFirst({
      where: { id: equipoInscripcionId, activo: true },
    });
    if (!inscripcion) {
      throw new NotFoundException('Equipo no encontrado');
    }

    await this.prisma.cuentaPublica.update({
      where: { id: cuentaId },
      data: { equipoSeguidoId: equipoInscripcionId, rol: 'seguidor' },
    });

    const user = await this.auth.buildSessionUser(cuentaId);
    const accessToken = await this.auth.signToken(cuentaId);
    return { accessToken, user };
  }

  async unfollowTeam(cuentaId: string) {
    await this.prisma.cuentaPublica.update({
      where: { id: cuentaId },
      data: { equipoSeguidoId: null, rol: 'usuario' },
    });
    const user = await this.auth.buildSessionUser(cuentaId);
    const accessToken = await this.auth.signToken(cuentaId);
    return { accessToken, user };
  }

  async getMeContext(cuentaId: string) {
    const cuenta = await this.prisma.cuentaPublica.findUniqueOrThrow({
      where: { id: cuentaId },
      include: {
        capitanAutorizado: { include: { equipoInscripcion: { include: { equipo: true } } } },
        equipoSeguido: { include: { equipo: true, torneo: { include: { categoria: true } } } },
        persona: {
          include: {
            inscripciones: {
              where: { activa: true },
              take: 1,
              include: {
                equipoInscripcion: {
                  include: { equipo: true, torneo: { include: { categoria: true } } },
                },
              },
            },
            eventos: true,
            suspensiones: { where: { activa: true } },
          },
        },
      },
    });

    let equipoInscripcionId: string | undefined;
    let torneoId: string | undefined;
    let equipo: {
      name: string;
      shortName?: string | null;
      color?: string | null;
      categoria?: string;
    } | null = null;

    if (cuenta.rol === 'capitan' && cuenta.capitanAutorizado) {
      equipoInscripcionId = cuenta.capitanAutorizado.equipoInscripcionId;
      torneoId = cuenta.capitanAutorizado.torneoId;
      const ins = cuenta.capitanAutorizado.equipoInscripcion;
      equipo = {
        name: ins.equipo.name,
        shortName: ins.abbr ?? ins.equipo.shortName,
        color: ins.color ?? ins.equipo.color,
      };
    } else if (cuenta.rol === 'jugador' && cuenta.persona?.inscripciones[0]) {
      const ins = cuenta.persona.inscripciones[0].equipoInscripcion;
      equipoInscripcionId = ins.id;
      torneoId = ins.torneoId;
      equipo = {
        name: ins.equipo.name,
        shortName: ins.abbr ?? ins.equipo.shortName,
        color: ins.color ?? ins.equipo.color,
        categoria: ins.torneo.categoria.nombre,
      };
    } else if (cuenta.rol === 'seguidor' && cuenta.equipoSeguido) {
      equipoInscripcionId = cuenta.equipoSeguido.id;
      torneoId = cuenta.equipoSeguido.torneoId;
      equipo = {
        name: cuenta.equipoSeguido.equipo.name,
        shortName: cuenta.equipoSeguido.abbr ?? cuenta.equipoSeguido.equipo.shortName,
        color: cuenta.equipoSeguido.color ?? cuenta.equipoSeguido.equipo.color,
        categoria: cuenta.equipoSeguido.torneo.categoria.nombre,
      };
    }

    let proximoPartidoDto: {
      id: string;
      fecha: string;
      hora: string | null;
      cancha: string | null;
      local: string;
      visitante: string;
      esLocal: boolean;
    } | null = null;
    let standingsPosition: unknown = null;

    if (torneoId && equipoInscripcionId) {
      const proximoPartido = await this.prisma.partidoFutbol.findFirst({
        where: {
          torneoId,
          status: 'pendiente',
          OR: [{ homeInscripcionId: equipoInscripcionId }, { awayInscripcionId: equipoInscripcionId }],
        },
        include: { homeTeam: true, awayTeam: true, cancha: true },
        orderBy: { date: 'asc' },
      });

      if (proximoPartido) {
        proximoPartidoDto = {
          id: proximoPartido.id,
          fecha: proximoPartido.date.toISOString(),
          hora: proximoPartido.horaInicio,
          cancha: proximoPartido.cancha
            ? `Cancha ${proximoPartido.cancha.numero}`
            : proximoPartido.venue,
          local: proximoPartido.homeTeam.name,
          visitante: proximoPartido.awayTeam.name,
          esLocal: proximoPartido.homeInscripcionId === equipoInscripcionId,
        };
      }

      const standings = await this.reglamentoEngine.getStandingsForTorneo(torneoId);
      standingsPosition = standings.find((s) => s.inscripcionId === equipoInscripcionId) ?? null;
    }

    const personalStats =
      cuenta.rol === 'jugador' && cuenta.persona
        ? {
            goles: cuenta.persona.eventos.filter((e) => e.tipo === 'gol').length,
            amarillas: cuenta.persona.eventos.filter((e) => e.tipo === 'amarilla').length,
            rojas: cuenta.persona.eventos.filter(
              (e) => e.tipo === 'roja' || e.tipo === 'expulsion_directa',
            ).length,
            suspensiones: cuenta.persona.suspensiones,
          }
        : null;

    return {
      user: await this.auth.buildSessionUser(cuentaId),
      equipo,
      proximoPartido: proximoPartidoDto,
      standingsPosition,
      personalStats,
      tieneStatsPersonales: cuenta.rol === 'jugador',
    };
  }
}

@Injectable()
export class PublicCaptainService {
  constructor(
    private prisma: PrismaService,
    private football: FootballService,
  ) {}

  private async getCapitanRecord(cuentaId: string) {
    const cap = await this.prisma.capitanAutorizado.findFirst({
      where: { cuentaPublicaId: cuentaId, activo: true },
      include: {
        equipoInscripcion: { include: { equipo: true } },
        torneo: { include: { categoria: true, campeonato: { include: { temporada: true } } } },
      },
    });
    if (!cap) {
      throw new ForbiddenException('Acceso solo para capitanes autorizados');
    }
    return cap;
  }

  async getTeam(cuentaId: string) {
    const cap = await this.getCapitanRecord(cuentaId);
    const plantel = await this.listRoster(cap.torneoId, cap.equipoInscripcionId);

    const proximoPartido = await this.prisma.partidoFutbol.findFirst({
      where: {
        torneoId: cap.torneoId,
        status: 'pendiente',
        OR: [
          { homeInscripcionId: cap.equipoInscripcionId },
          { awayInscripcionId: cap.equipoInscripcionId },
        ],
      },
      include: { homeTeam: true, awayTeam: true, cancha: true },
      orderBy: { date: 'asc' },
    });

    return {
      equipo: {
        id: cap.equipoInscripcion.id,
        name: cap.equipoInscripcion.equipo.name,
        shortName: cap.equipoInscripcion.abbr,
        color: cap.equipoInscripcion.color,
        categoria: cap.torneo.categoria.nombre,
        maxPlantel: cap.torneo.categoria.maxPlantel,
      },
      torneo: {
        id: cap.torneo.id,
        nombre: cap.torneo.nombre,
        campeonato: cap.torneo.campeonato.nombre,
      },
      plantel,
      proximoPartido: proximoPartido
        ? {
            fecha: proximoPartido.date.toISOString(),
            hora: proximoPartido.horaInicio,
            cancha: proximoPartido.cancha
              ? `Cancha ${proximoPartido.cancha.numero}`
              : proximoPartido.venue,
            rival:
              proximoPartido.homeInscripcionId === cap.equipoInscripcionId
                ? proximoPartido.awayTeam.name
                : proximoPartido.homeTeam.name,
          }
        : null,
    };
  }

  async listRoster(torneoId: string, equipoInscripcionId: string) {
    const rows = await this.prisma.inscripcionJugador.findMany({
      where: { torneoId, equipoInscripcionId, activa: true },
      include: { persona: true },
      orderBy: [{ rolPlantel: 'asc' }, { persona: { apellido: 'asc' } }],
    });

    return rows.map((r) => ({
      personaId: r.personaId,
      inscripcionId: r.id,
      nombre: r.persona.nombre,
      apellido: r.persona.apellido,
      dni: r.persona.dni,
      email: r.persona.email,
      fechaNacimiento: r.persona.fechaNacimiento?.toISOString().slice(0, 10) ?? null,
      numeroCamiseta: r.numeroCamiseta,
      rolPlantel: r.rolPlantel,
    }));
  }

  async addPlayer(cuentaId: string, dto: RosterPlayerDto) {
    const cap = await this.getCapitanRecord(cuentaId);
    await this.validateRosterLimits(cap.torneoId, cap.equipoInscripcionId, cap.torneo.categoria.maxPlantel);
    await this.ensureDniAvailable(dto.dni, cap.torneoId);

    const fechaNac = new Date(dto.fechaNacimiento);
    this.validateAge(fechaNac, cap.torneo.campeonato.temporada.inicio);

    const persona = await this.prisma.persona.upsert({
      where: { dni: dto.dni.replace(/\D/g, '') },
      update: {
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email.toLowerCase(),
        fechaNacimiento: fechaNac,
      },
      create: {
        dni: dto.dni.replace(/\D/g, ''),
        nombre: dto.nombre,
        apellido: dto.apellido,
        email: dto.email.toLowerCase(),
        fechaNacimiento: fechaNac,
      },
    });

    await this.prisma.inscripcionJugador.upsert({
      where: { personaId_torneoId: { personaId: persona.id, torneoId: cap.torneoId } },
      update: {
        equipoInscripcionId: cap.equipoInscripcionId,
        activa: true,
        numeroCamiseta: dto.numeroCamiseta,
        rolPlantel: dto.rolPlantel ?? 'jugador',
      },
      create: {
        personaId: persona.id,
        torneoId: cap.torneoId,
        equipoInscripcionId: cap.equipoInscripcionId,
        numeroCamiseta: dto.numeroCamiseta,
        rolPlantel: dto.rolPlantel ?? 'jugador',
        activa: true,
      },
    });

    return this.getTeam(cuentaId);
  }

  async updatePlayer(cuentaId: string, personaId: string, dto: Partial<RosterPlayerDto>) {
    const cap = await this.getCapitanRecord(cuentaId);
    const inscripcion = await this.prisma.inscripcionJugador.findFirst({
      where: {
        personaId,
        torneoId: cap.torneoId,
        equipoInscripcionId: cap.equipoInscripcionId,
        activa: true,
      },
    });
    if (!inscripcion) throw new NotFoundException('Jugador no encontrado en tu plantel');

    if (dto.dni) {
      await this.ensureDniAvailable(dto.dni, cap.torneoId, personaId);
    }

    await this.prisma.persona.update({
      where: { id: personaId },
      data: {
        ...(dto.nombre ? { nombre: dto.nombre } : {}),
        ...(dto.apellido ? { apellido: dto.apellido } : {}),
        ...(dto.email ? { email: dto.email.toLowerCase() } : {}),
        ...(dto.fechaNacimiento ? { fechaNacimiento: new Date(dto.fechaNacimiento) } : {}),
        ...(dto.dni ? { dni: dto.dni.replace(/\D/g, '') } : {}),
      },
    });

    if (dto.numeroCamiseta !== undefined || dto.rolPlantel) {
      await this.prisma.inscripcionJugador.update({
        where: { id: inscripcion.id },
        data: {
          ...(dto.numeroCamiseta !== undefined ? { numeroCamiseta: dto.numeroCamiseta } : {}),
          ...(dto.rolPlantel ? { rolPlantel: dto.rolPlantel } : {}),
        },
      });
    }

    return this.getTeam(cuentaId);
  }

  async getListaBuenaFeHtml(cuentaId: string) {
    const cap = await this.getCapitanRecord(cuentaId);
    return this.football.getListaBuenaFeHtml(cap.equipoInscripcionId);
  }

  async removePlayer(cuentaId: string, personaId: string) {
    const cap = await this.getCapitanRecord(cuentaId);
    const updated = await this.prisma.inscripcionJugador.updateMany({
      where: {
        personaId,
        torneoId: cap.torneoId,
        equipoInscripcionId: cap.equipoInscripcionId,
        activa: true,
      },
      data: { activa: false },
    });
    if (!updated.count) throw new NotFoundException('Jugador no encontrado');
    return this.getTeam(cuentaId);
  }

  private async validateRosterLimits(torneoId: string, equipoInscripcionId: string, max: number) {
    const count = await this.prisma.inscripcionJugador.count({
      where: { torneoId, equipoInscripcionId, activa: true },
    });
    if (count >= max) {
      throw new ConflictException(`Plantel completo (máximo ${max} jugadores)`);
    }
  }

  private async ensureDniAvailable(dni: string, torneoId: string, excludePersonaId?: string) {
    const normalized = dni.replace(/\D/g, '');
    const torneo = await this.prisma.torneo.findUnique({
      where: { id: torneoId },
      select: { campeonatoId: true },
    });
    if (!torneo) return;

    const activeTorneoIds = (
      await this.prisma.torneo.findMany({
        where: { campeonatoId: torneo.campeonatoId, activo: true },
        select: { id: true },
      })
    ).map((t) => t.id);

    const existing = await this.prisma.inscripcionJugador.findFirst({
      where: {
        torneoId: { in: activeTorneoIds },
        activa: true,
        persona: { dni: normalized },
        ...(excludePersonaId ? { NOT: { personaId: excludePersonaId } } : {}),
      },
      include: {
        equipoInscripcion: { include: { equipo: true } },
        torneo: { include: { categoria: true } },
      },
    });
    if (existing) {
      throw new ConflictException(
        `El DNI ya está inscripto en ${existing.equipoInscripcion.equipo.name} (${existing.torneo.categoria.nombre})`,
      );
    }
  }

  private validateAge(fechaNac: Date, torneoInicio: Date) {
    const cutoff = new Date(torneoInicio);
    cutoff.setFullYear(cutoff.getFullYear() - 18);
    if (fechaNac > cutoff) {
      throw new BadRequestException(
        'El jugador debe tener 18 años cumplidos al inicio del campeonato',
      );
    }
  }
}
