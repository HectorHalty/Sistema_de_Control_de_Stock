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

  async getTorneoDetail(torneoId?: string) {
    const torneo = torneoId
      ? await this.prisma.torneo.findUnique({
          where: { id: torneoId },
          include: {
            categoria: true,
            campeonato: { include: { temporada: true } },
          },
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

    const [standings, partidos, equipos] = await Promise.all([
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
    ]);

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
      partidos: partidos.map((m) => ({
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
    };
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
