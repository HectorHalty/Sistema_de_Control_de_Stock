import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { ReglamentoEngineService } from '../reglamento/reglamento-engine.service';

function slugifyCategory(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

@Injectable()
export class PublicService {
  constructor(
    private prisma: PrismaService,
    private reglamentoEngine: ReglamentoEngineService,
  ) {}

  async getHomeBundle() {
    const torneo = await this.prisma.torneo.findFirst({
      where: { activo: true, publicado: true },
      include: {
        categoria: true,
        campeonato: { include: { temporada: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!torneo) {
      const sponsors = await this.listSponsors();
      const menu = await this.listMenu();
      return {
        torneo: null,
        proximosPartidos: [],
        standings: [],
        sponsors,
        menuCount: menu.items.length,
      };
    }

    const [proximosPartidos, standings, sponsors, menu] = await Promise.all([
      this.listUpcomingMatches(torneo.id),
      this.reglamentoEngine.getStandingsForTorneo(torneo.id),
      this.listSponsors(),
      this.listMenu(),
    ]);

    return {
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
        categoria: torneo.categoria.nombre,
        categoriaCodigo: torneo.categoria.codigo,
        campeonato: torneo.campeonato.nombre,
        temporada: torneo.campeonato.temporada.nombre,
        anio: torneo.campeonato.temporada.anio,
      },
      proximosPartidos,
      standings: standings.slice(0, 8),
      sponsors,
      menuCount: menu.items.length,
    };
  }

  async listUpcomingMatches(torneoId: string) {
    const now = new Date();
    const matches = await this.prisma.partidoFutbol.findMany({
      where: {
        torneoId,
        status: 'pendiente',
        date: { gte: now },
        OR: [
          { jornadaId: null },
          { jornada: { publicada: true, suspendida: false } },
        ],
      },
      include: {
        homeTeam: true,
        awayTeam: true,
        cancha: true,
        jornada: true,
      },
      orderBy: { date: 'asc' },
      take: 6,
    });

    return matches.map((m) => ({
      id: m.id,
      fecha: m.date.toISOString(),
      hora: m.horaInicio ?? m.date.toISOString().slice(11, 16),
      cancha: m.cancha ? `Cancha ${m.cancha.numero}` : m.venue,
      jornada: m.jornada?.numero ?? null,
      local: { id: m.homeTeam.id, name: m.homeTeam.name, shortName: m.homeTeam.shortName },
      visitante: { id: m.awayTeam.id, name: m.awayTeam.name, shortName: m.awayTeam.shortName },
    }));
  }

  async listTorneosPublic() {
    const torneos = await this.prisma.torneo.findMany({
      where: { activo: true, publicado: true, campeonato: { activo: true } },
      include: {
        categoria: true,
        campeonato: { include: { temporada: true } },
      },
      orderBy: [{ campeonato: { nombre: 'asc' } }, { categoria: { nombre: 'asc' } }],
    });

    return torneos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      categoria: t.categoria.nombre,
      categoriaCodigo: t.categoria.codigo,
      categoriaColor: t.categoria.colorHex,
      campeonato: t.campeonato.nombre,
      temporada: t.campeonato.temporada.nombre,
    }));
  }

  async getTorneoDetail(torneoId?: string, categoriaCodigo?: string) {
    const torneo = torneoId
      ? await this.prisma.torneo.findUnique({
          where: { id: torneoId },
          include: {
            categoria: true,
            campeonato: { include: { temporada: true } },
          },
        })
      : categoriaCodigo
        ? await this.prisma.torneo.findFirst({
            where: {
              publicado: true,
              activo: true,
              categoria: { codigo: categoriaCodigo },
              campeonato: { activo: true },
            },
            include: {
              categoria: true,
              campeonato: { include: { temporada: true } },
            },
            orderBy: { updatedAt: 'desc' },
          })
        : await this.prisma.torneo.findFirst({
            where: { activo: true, publicado: true },
            include: {
              categoria: true,
              campeonato: { include: { temporada: true } },
            },
            orderBy: { updatedAt: 'desc' },
          });

    if (!torneo) return null;

    const [standings, partidos, equipos, goleadores, suspensiones, tarjetas] = await Promise.all([
      this.reglamentoEngine.getStandingsForTorneo(torneo.id),
      this.prisma.partidoFutbol.findMany({
        where: { torneoId: torneo.id },
        include: { homeTeam: true, awayTeam: true, cancha: true, jornada: true },
        orderBy: { date: 'asc' },
      }),
      this.prisma.equipoInscripcion.findMany({
        where: { torneoId: torneo.id, activo: true },
        include: { equipo: true },
      }),
      this.getTopScorers(torneo.id),
      this.listActiveSuspensions(torneo.id),
      this.listTarjetas(torneo.id),
    ]);

    const visiblePartidos = partidos.filter(
      (p) =>
        p.status === 'jugado' ||
        !p.jornada ||
        (p.jornada.publicada && !p.jornada.suspendida),
    );

    return {
      torneo: {
        id: torneo.id,
        nombre: torneo.nombre,
        categoria: torneo.categoria.nombre,
        campeonato: torneo.campeonato.nombre,
        temporada: torneo.campeonato.temporada.nombre,
      },
      standings,
      equipos: equipos.map((e) => ({
        id: e.id,
        name: e.equipo.name,
        shortName: e.abbr ?? e.equipo.shortName,
        color: e.color ?? e.equipo.color,
      })),
      partidos: visiblePartidos.map((m) => ({
        id: m.id,
        fecha: m.date.toISOString(),
        hora: m.horaInicio,
        cancha: m.cancha ? `Cancha ${m.cancha.numero}` : m.venue,
        jornada: m.jornada?.numero ?? null,
        status: m.status,
        homeGoals: m.homeGoals,
        awayGoals: m.awayGoals,
        local: m.homeTeam.name,
        visitante: m.awayTeam.name,
      })),
      goleadores,
      suspensiones,
      tarjetas,
    };
  }

  async listTarjetas(torneoId: string) {
    const cardTypes = ['amarilla', 'roja', 'doble_amarilla', 'azul', 'expulsion_directa'];
    const labelByType: Record<string, string> = {
      amarilla: 'Amarilla',
      roja: 'Roja',
      doble_amarilla: 'Doble amarilla',
      azul: 'Azul',
      expulsion_directa: 'Expulsión directa',
    };

    const eventos = await this.prisma.eventoPartido.findMany({
      where: {
        tipo: { in: cardTypes },
        partido: { torneoId, status: 'jugado' },
      },
      include: {
        persona: true,
        partido: {
          include: { homeTeam: true, awayTeam: true, jornada: true },
        },
      },
      orderBy: [{ partido: { date: 'desc' } }, { minuto: 'asc' }],
      take: 100,
    });

    if (!eventos.length) return [];

    const personaIds = [...new Set(eventos.map((e) => e.personaId))];
    const inscripciones = await this.prisma.inscripcionJugador.findMany({
      where: { torneoId, activa: true, personaId: { in: personaIds } },
      include: { equipoInscripcion: { include: { equipo: true } } },
    });
    const teamByPersona = new Map(
      inscripciones.map((i) => [i.personaId, i.equipoInscripcion.equipo.name]),
    );

    return eventos.map((ev) => {
      const p = ev.partido;
      const local = p.homeTeam.name;
      const visitante = p.awayTeam.name;
      return {
        id: ev.id,
        jugador: `${ev.persona.nombre} ${ev.persona.apellido}`.trim(),
        equipo: teamByPersona.get(ev.personaId) ?? '—',
        tipo: ev.tipo,
        tipoLabel: labelByType[ev.tipo] ?? ev.tipo,
        minuto: ev.minuto,
        jornada: p.jornada?.numero ?? null,
        partido: `${local} vs ${visitante}`,
        fecha: p.date.toISOString(),
      };
    });
  }

  async listActiveSuspensions(torneoId: string) {
    const rows = await this.prisma.suspension.findMany({
      where: { torneoId, activa: true, fechasRestantes: { gt: 0 } },
      include: { persona: true },
      orderBy: [{ fechasRestantes: 'desc' }, { updatedAt: 'desc' }],
    });

    const personaIds = rows.map((r) => r.personaId);
    const inscripciones = personaIds.length
      ? await this.prisma.inscripcionJugador.findMany({
          where: { torneoId, activa: true, personaId: { in: personaIds } },
          include: { equipoInscripcion: { include: { equipo: true } } },
        })
      : [];

    const teamByPersona = new Map(
      inscripciones.map((i) => [i.personaId, i.equipoInscripcion.equipo.name]),
    );

    return rows.map((r) => ({
      id: r.id,
      jugador: r.persona
        ? `${r.persona.nombre} ${r.persona.apellido}`.trim()
        : 'Jugador',
      dni: r.persona?.dni ?? null,
      equipo: teamByPersona.get(r.personaId) ?? '—',
      motivo: r.motivo,
      fechasRestantes: r.fechasRestantes,
    }));
  }

  async getTopScorers(torneoId: string, limit = 20) {
    const eventos = await this.prisma.eventoPartido.findMany({
      where: {
        tipo: 'gol',
        partido: { torneoId, status: 'jugado' },
      },
      select: { personaId: true },
    });

    if (!eventos.length) return [];

    const counts = new Map<string, number>();
    for (const ev of eventos) {
      counts.set(ev.personaId, (counts.get(ev.personaId) ?? 0) + 1);
    }

    const personaIds = [...counts.keys()];
    const [personas, inscripciones] = await Promise.all([
      this.prisma.persona.findMany({
        where: { id: { in: personaIds } },
        select: { id: true, nombre: true, apellido: true },
      }),
      this.prisma.inscripcionJugador.findMany({
        where: { torneoId, activa: true, personaId: { in: personaIds } },
        include: { equipoInscripcion: { include: { equipo: true } } },
      }),
    ]);

    const personaMap = new Map(personas.map((p) => [p.id, p]));
    const teamMap = new Map(
      inscripciones.map((i) => [i.personaId, i.equipoInscripcion.equipo.name]),
    );

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([personaId, goals], idx) => {
        const persona = personaMap.get(personaId);
        const name = persona
          ? `${persona.nombre} ${persona.apellido}`.trim()
          : 'Jugador';
        return {
          rank: idx + 1,
          personaId,
          player: name,
          team: teamMap.get(personaId) ?? '—',
          goals,
        };
      });
  }

  async listReglamento() {
    const apartados = await this.prisma.reglamentoApartado.findMany({
      orderBy: { orden: 'asc' },
      include: {
        articulos: { orderBy: { orden: 'asc' } },
      },
    });

    const anexos = await this.prisma.reglamentoAnexo.findMany({
      orderBy: { orden: 'asc' },
      include: { reglas: { orderBy: { orden: 'asc' } } },
    });

    return { apartados, anexos };
  }

  async listMenu() {
    const [items, categories, filters] = await Promise.all([
      this.prisma.productoVenta.findMany({
        where: { active: true, visibleWeb: true },
        include: {
          kitchen: true,
          webCategory: { select: { id: true, name: true, slug: true } },
          filtrosWeb: { include: { filtro: { select: { slug: true, label: true } } } },
        },
        orderBy: [{ webSortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.categoriaWeb.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, slug: true },
      }),
      this.prisma.filtroWeb.findMany({
        where: { active: true },
        orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
        select: { slug: true, label: true },
      }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.webCategory?.name ?? item.category,
        categorySlug: item.webCategory?.slug ?? slugifyCategory(item.category),
        price: Number(item.price),
        emoji: item.emoji,
        description: item.descripcionWeb,
        imageUrl: item.imagenWeb,
        kitchen: item.kitchen.name,
        popular: item.popularWeb,
        filters: item.filtrosWeb.map((f) => f.filtro.slug),
      })),
      categories,
      filters,
    };
  }

  async listSponsors() {
    return this.prisma.patrocinador.findMany({
      where: { active: true },
      orderBy: [{ placement: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        imageUrl: true,
        placement: true,
        bannerLabel: true,
        mediaType: true,
        widthPx: true,
        heightPx: true,
        linkUrl: true,
      },
    });
  }

  async listMedia(type?: string) {
    const items = await this.prisma.medio.findMany({
      where: type ? { type } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return items.map((m) => ({
      id: m.id,
      title: m.title,
      type: m.type,
      url: m.url,
      mimeType: m.mimeType,
      matchDate: m.matchDate,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}
