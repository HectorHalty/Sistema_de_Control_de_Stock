import { describe, expect, it } from 'vitest';
import {
  bergerRoundToPairs,
  buildBergerRounds,
  chooseOffset,
  numberTeams,
  pairKey,
} from '../src/football/berger';

function pairsOf(n: number, roundIndex: number) {
  const r = buildBergerRounds(n)[roundIndex];
  return { bye: r.bye, pairs: r.pairs.map((p) => [p.home, p.away] as const) };
}

describe('buildBergerRounds', () => {
  it('13 equipos fecha 1 = modelo PDF', () => {
    expect(pairsOf(13, 0)).toEqual({
      bye: 1,
      pairs: [
        [2, 13],
        [3, 12],
        [4, 11],
        [5, 10],
        [6, 9],
        [7, 8],
      ],
    });
  });

  it('13 equipos fecha 2 = modelo PDF', () => {
    expect(pairsOf(13, 1)).toEqual({
      bye: 8,
      pairs: [
        [9, 7],
        [10, 6],
        [11, 5],
        [12, 4],
        [13, 3],
        [1, 2],
      ],
    });
  });

  it('7 y 11 equipos fecha 1', () => {
    expect(pairsOf(7, 0)).toEqual({
      bye: 1,
      pairs: [
        [2, 7],
        [3, 6],
        [4, 5],
      ],
    });
    expect(pairsOf(11, 0)).toEqual({
      bye: 1,
      pairs: [
        [2, 11],
        [3, 10],
        [4, 9],
        [5, 8],
        [6, 7],
      ],
    });
  });

  it('8 equipos fecha 1 y fecha 2 (local/visitante del extra)', () => {
    expect(pairsOf(8, 0)).toEqual({
      bye: null,
      pairs: [
        [1, 8],
        [2, 7],
        [3, 6],
        [4, 5],
      ],
    });
    expect(pairsOf(8, 1)).toEqual({
      bye: null,
      pairs: [
        [8, 5],
        [6, 4],
        [7, 3],
        [1, 2],
      ],
    });
  });

  it('12 y 14 equipos fecha 1: N juega contra el 1', () => {
    expect(pairsOf(12, 0).pairs[0]).toEqual([1, 12]);
    expect(pairsOf(12, 0).bye).toBeNull();
    expect(pairsOf(14, 0).pairs[0]).toEqual([1, 14]);
  });

  it('13 equipos: cada par una vez y cada equipo un bye', () => {
    const rounds = buildBergerRounds(13);
    expect(rounds).toHaveLength(13);
    const seen = new Set<string>();
    const byes = new Map<number, number>();
    for (const r of rounds) {
      expect(r.bye).not.toBeNull();
      byes.set(r.bye!, (byes.get(r.bye!) ?? 0) + 1);
      const inRound = new Set<number>([r.bye!]);
      for (const p of r.pairs) {
        const key = p.home < p.away ? `${p.home}-${p.away}` : `${p.away}-${p.home}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
        inRound.add(p.home);
        inRound.add(p.away);
      }
      expect(inRound.size).toBe(13);
    }
    expect(seen.size).toBe((13 * 12) / 2);
    for (let i = 1; i <= 13; i++) expect(byes.get(i)).toBe(1);
  });

  it('12 equipos: 11 fechas, cada par una vez, nadie libre', () => {
    const rounds = buildBergerRounds(12);
    expect(rounds).toHaveLength(11);
    const seen = new Set<string>();
    for (const r of rounds) {
      expect(r.bye).toBeNull();
      expect(r.pairs).toHaveLength(6);
      for (const p of r.pairs) {
        const key = p.home < p.away ? `${p.home}-${p.away}` : `${p.away}-${p.home}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe((12 * 11) / 2);
  });
});

describe('numberTeams', () => {
  it('ordena por nombre es y desempata por equipoId', () => {
    const rows = [
      { id: 'i2', equipoId: 'b', equipo: { name: 'Tortu' } },
      { id: 'i1', equipoId: 'a', equipo: { name: 'Discoteca A.F.' } },
      { id: 'i3', equipoId: 'c', equipo: { name: 'discoteca a.f.' } },
    ];
    const numbered = numberTeams(rows);
    expect(numbered.map((r) => r.id)).toEqual(['i1', 'i3', 'i2']);
  });
});

describe('chooseOffset', () => {
  it('con el mismo plantel y R>=2 elige s=1 y cero choques', () => {
    const rounds = buildBergerRounds(4);
    const ids = ['', 'A', 'B', 'C', 'D'];
    const prev = new Map<string, number>();
    rounds.forEach((r, i) => {
      for (const p of r.pairs) prev.set(pairKey(ids[p.home], ids[p.away]), i + 1);
    });
    const { offset, choques } = chooseOffset(rounds, (n) => ids[n], prev);
    expect(offset).toBe(1);
    expect(choques).toBe(0);
  });

  it('R=1 no corre', () => {
    const rounds = buildBergerRounds(2);
    const { offset } = chooseOffset(rounds, (n) => String(n), new Map([[pairKey('1', '2'), 1]]));
    expect(offset).toBe(0);
  });
});

describe('bergerRoundToPairs', () => {
  it('mapea número → inscripción y el bye', () => {
    const numbered = [
      { id: 'ins-1', equipoId: 'eq-1' },
      { id: 'ins-2', equipoId: 'eq-2' },
      { id: 'ins-3', equipoId: 'eq-3' },
    ];
    const { pairs, byeInscripcionId } = bergerRoundToPairs(buildBergerRounds(3)[0], numbered);
    expect(byeInscripcionId).toBe('ins-1');
    expect(pairs).toHaveLength(1);
    expect(pairs[0][0].id).toBe('ins-2');
    expect(pairs[0][1].id).toBe('ins-3');
  });
});
