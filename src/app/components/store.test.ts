import { describe, expect, it } from 'vitest';
import { roundUpToOrderUnit, getUnitLabel } from './store';

describe('store utilities', () => {
  describe('roundUpToOrderUnit', () => {
    it('returns quantity as-is when no orderUnit defined', () => {
      expect(roundUpToOrderUnit(47, undefined)).toBe(47);
      expect(roundUpToOrderUnit(47, 0)).toBe(47);
      expect(roundUpToOrderUnit(47, 1)).toBe(47);
    });

    it('rounds up to nearest pack multiple', () => {
      // avg=47, pack=24 => 48 (2 packs)
      expect(roundUpToOrderUnit(47, 24)).toBe(48);
      // avg=25, pack=24 => 48 (2 packs)
      expect(roundUpToOrderUnit(25, 24)).toBe(48);
      // avg=24, pack=24 => 24 (exact pack)
      expect(roundUpToOrderUnit(24, 24)).toBe(24);
      // avg=1, pack=24 => 24 (1 pack)
      expect(roundUpToOrderUnit(1, 24)).toBe(24);
      // avg=0, pack=24 => 0
      expect(roundUpToOrderUnit(0, 24)).toBe(0);
    });

    it('handles larger pack sizes', () => {
      // avg=100, pack=48 => 144 (3 packs)
      expect(roundUpToOrderUnit(100, 48)).toBe(144);
      // avg=96, pack=48 => 96 (exact)
      expect(roundUpToOrderUnit(96, 48)).toBe(96);
    });

    it('handles negative quantities (should not happen but be safe)', () => {
      expect(roundUpToOrderUnit(-5, 24)).toBe(0);
    });
  });

  describe('getUnitLabel', () => {
    it('returns correct labels for unidades', () => {
      expect(getUnitLabel('unidades')).toBe('unidades');
      expect(getUnitLabel('unidades', true)).toBe('uds');
    });

    it('returns correct labels for kg', () => {
      expect(getUnitLabel('kg')).toBe('kg');
      expect(getUnitLabel('kg', true)).toBe('kg');
    });
  });
});
