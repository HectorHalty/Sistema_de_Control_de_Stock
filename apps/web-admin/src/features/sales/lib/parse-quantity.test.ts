import { describe, expect, it } from 'vitest';
import {
  formatQuantityInput,
  isPartialQuantityInput,
  parseQuantityInput,
} from './parse-quantity';

describe('parseQuantityInput', () => {
  it('parses comma and dot decimals', () => {
    expect(parseQuantityInput('0,1')).toBe(0.1);
    expect(parseQuantityInput('0.1')).toBe(0.1);
    expect(parseQuantityInput('10')).toBe(10);
  });

  it('returns null for empty or invalid', () => {
    expect(parseQuantityInput('')).toBeNull();
    expect(parseQuantityInput('abc')).toBeNull();
  });
});

describe('formatQuantityInput', () => {
  it('uses comma as decimal separator', () => {
    expect(formatQuantityInput(0.1)).toBe('0,1');
  });
});

describe('isPartialQuantityInput', () => {
  it('allows typing decimals with comma', () => {
    expect(isPartialQuantityInput('0,')).toBe(true);
    expect(isPartialQuantityInput('0,1')).toBe(true);
    expect(isPartialQuantityInput('1.5')).toBe(true);
    expect(isPartialQuantityInput('1a')).toBe(false);
  });
});
