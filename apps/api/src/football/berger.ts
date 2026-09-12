export type BergerPair = { home: number; away: number };
export type BergerRound = { bye: number | null; pairs: BergerPair[] };

function buildOddRound0(n: number): BergerRound {
  const pairs: BergerPair[] = [];
  for (let i = 2; i <= Math.floor(n / 2) + 1; i++) {
    pairs.push({ home: i, away: n + 2 - i });
  }
  return { bye: 1, pairs };
}

function rotateTeam(x: number, offset: number, n: number): number {
  return ((x - 1 + offset) % n) + 1;
}

function rotateRound(round: BergerRound, offset: number, n: number): BergerRound {
  return {
    bye: round.bye !== null ? rotateTeam(round.bye, offset, n) : null,
    pairs: round.pairs.map((p) => ({
      home: rotateTeam(p.home, offset, n),
      away: rotateTeam(p.away, offset, n),
    })),
  };
}

function buildOddBergerRounds(n: number): BergerRound[] {
  const round0 = buildOddRound0(n);
  const rounds: BergerRound[] = [];
  for (let k = 0; k < n; k++) {
    const offset = k % 2 === 0 ? k / 2 : Math.floor(k / 2) + (n + 1) / 2;
    rounds.push(rotateRound(round0, offset, n));
  }
  return rounds;
}

function buildEvenBergerRounds(n: number): BergerRound[] {
  const oddRounds = buildOddBergerRounds(n - 1);
  return oddRounds.map((r, k) => {
    const extraPair: BergerPair =
      k % 2 === 0
        ? { home: r.bye!, away: n }
        : { home: n, away: r.bye! };
    return {
      bye: null,
      pairs: [extraPair, ...r.pairs],
    };
  });
}

export function buildBergerRounds(n: number): BergerRound[] {
  if (n % 2 === 0) {
    return buildEvenBergerRounds(n);
  }
  return buildOddBergerRounds(n);
}

export type NumberableInscription = {
  id: string;
  equipoId: string;
  equipo: { name: string };
};

export function numberTeams<T extends NumberableInscription>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const byName = a.equipo.name.localeCompare(b.equipo.name, 'es', {
      sensitivity: 'base',
    });
    if (byName !== 0) return byName;
    return a.equipoId.localeCompare(b.equipoId);
  });
}

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function chooseOffset(
  rounds: BergerRound[],
  equipoIdByNumber: (n: number) => string,
  previousFechaByPair: Map<string, number>,
): { offset: number; choques: number } {
  const R = rounds.length;
  if (R <= 1 || previousFechaByPair.size === 0) {
    return { offset: 0, choques: 0 };
  }

  function countChoques(offset: number): number {
    let choques = 0;
    for (let i = 0; i < R; i++) {
      const round = rounds[(i + offset) % R];
      for (const p of round.pairs) {
        const key = pairKey(equipoIdByNumber(p.home), equipoIdByNumber(p.away));
        if (previousFechaByPair.get(key) === i + 1) {
          choques++;
        }
      }
    }
    return choques;
  }

  for (let s = 1; s < R; s++) {
    const choques = countChoques(s);
    if (choques === 0) {
      return { offset: s, choques: 0 };
    }
  }

  let bestOffset = 0;
  let bestChoques = countChoques(0);
  for (let s = 1; s < R; s++) {
    const choques = countChoques(s);
    if (
      choques < bestChoques ||
      (choques === bestChoques && bestOffset === 0)
    ) {
      bestChoques = choques;
      bestOffset = s;
    }
  }
  return { offset: bestOffset, choques: bestChoques };
}

export function bergerRoundToPairs<T extends { id: string; equipoId: string }>(
  round: BergerRound,
  numbered: T[],
): { pairs: [T, T][]; byeInscripcionId: string | null } {
  const pairs = round.pairs.map(
    (p) => [numbered[p.home - 1], numbered[p.away - 1]] as [T, T],
  );
  const byeInscripcionId =
    round.bye !== null ? numbered[round.bye - 1].id : null;
  return { pairs, byeInscripcionId };
}
