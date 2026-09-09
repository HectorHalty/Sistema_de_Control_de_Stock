import type { PublicSponsor } from '../../../api/public-api';

export function orderSponsorsForSlot(
  sponsors: PublicSponsor[],
  slot: 'home' | 'cantina',
): PublicSponsor[] {
  return sponsors.filter((s) => s.placement === slot);
}

export function carouselDwellMs(sponsor: PublicSponsor): number {
  const raw = sponsor.durationSeconds ?? 5;
  const clamped = Math.min(60, Math.max(2, Math.round(raw)));
  return clamped * 1000;
}

export function nextIndex(current: number, length: number): number {
  if (length <= 0) return 0;
  return (current + 1) % length;
}
