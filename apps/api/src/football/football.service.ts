import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class FootballService {
  constructor(private prisma: PrismaService) {}

  // Teams
  async findAllTeams() {
    return this.prisma.footballTeam.findMany({ orderBy: { name: 'asc' } });
  }

  async createTeam(data: { name: string; shortName?: string; logo?: string }) {
    return this.prisma.footballTeam.create({ data });
  }

  // Matches
  async findAllMatches(status?: string) {
    return this.prisma.footballMatch.findMany({
      where: status ? { status } : undefined,
      include: { homeTeam: true, awayTeam: true },
      orderBy: { date: 'asc' },
    });
  }

  async createMatch(data: {
    homeTeamId: string; awayTeamId: string; date: string; venue?: string;
  }) {
    return this.prisma.footballMatch.create({
      data: {
        homeTeamId: data.homeTeamId,
        awayTeamId: data.awayTeamId,
        date: new Date(data.date),
        venue: data.venue,
        status: 'pendiente',
      },
      include: { homeTeam: true, awayTeam: true },
    });
  }

  async updateMatchScore(id: string, homeGoals: number, awayGoals: number) {
    const match = await this.prisma.footballMatch.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Match ${id} not found`);

    return this.prisma.footballMatch.update({
      where: { id },
      data: { homeGoals, awayGoals, status: 'jugado' },
      include: { homeTeam: true, awayTeam: true },
    });
  }

  // Standings (computed)
  async getStandings() {
    const teams = await this.prisma.footballTeam.findMany();
    const matches = await this.prisma.footballMatch.findMany({
      where: { status: 'jugado' },
    });

    const standings = new Map<string, any>();
    teams.forEach(t => {
      standings.set(t.id, {
        teamId: t.id,
        teamName: t.name,
        played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, points: 0,
      });
    });

    matches.forEach(m => {
      const home = standings.get(m.homeTeamId);
      const away = standings.get(m.awayTeamId);
      if (!home || !away) return;

      const hg = m.homeGoals ?? 0;
      const ag = m.awayGoals ?? 0;

      home.played++; away.played++;
      home.goalsFor += hg; home.goalsAgainst += ag;
      away.goalsFor += ag; away.goalsAgainst += hg;

      if (hg > ag) { home.won++; home.points += 3; away.lost++; }
      else if (hg < ag) { away.won++; away.points += 3; home.lost++; }
      else { home.drawn++; away.drawn++; home.points++; away.points++; }
    });

    return Array.from(standings.values()).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdA = a.goalsFor - a.goalsAgainst;
      const gdB = b.goalsFor - b.goalsAgainst;
      if (gdB !== gdA) return gdB - gdA;
      return b.goalsFor - a.goalsFor;
    });
  }
}
