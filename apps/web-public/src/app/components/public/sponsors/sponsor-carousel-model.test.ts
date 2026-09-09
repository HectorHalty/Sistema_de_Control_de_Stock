import { describe, it, expect } from 'vitest';
import { orderSponsorsForSlot, carouselDwellMs, nextIndex } from './sponsor-carousel-model';
import type { PublicSponsor } from '../../../api/public-api';

const s = (over: Partial<PublicSponsor>): PublicSponsor =>
  ({ id: 'x', name: 'X', imageUrl: '/x', placement: 'home', ...over } as PublicSponsor);

describe('sponsor-carousel-model', () => {
  it('orderSponsorsForSlot filtra por slot y preserva el orden recibido', () => {
    const list = [
      s({ id: 'a', placement: 'home' }),
      s({ id: 'b', placement: 'cantina' }),
      s({ id: 'c', placement: 'home' }),
    ];
    expect(orderSponsorsForSlot(list, 'home').map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('carouselDwellMs usa durationSeconds del ítem, con clamp 2–60 y default 5', () => {
    expect(carouselDwellMs(s({ durationSeconds: 8 }))).toBe(8000);
    expect(carouselDwellMs(s({ durationSeconds: undefined }))).toBe(5000);
    expect(carouselDwellMs(s({ durationSeconds: 1 }))).toBe(2000);
    expect(carouselDwellMs(s({ durationSeconds: 120 }))).toBe(60000);
  });

  it('nextIndex rota y vuelve a 0', () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(2, 3)).toBe(0);
  });
});
