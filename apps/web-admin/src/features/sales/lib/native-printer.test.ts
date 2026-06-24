import { describe, expect, it } from 'vitest';
import { isPrivateLanIp } from './native-printer';

describe('isPrivateLanIp', () => {
  it('acepta IPs 192.168.0.x del club', () => {
    expect(isPrivateLanIp('192.168.0.12')).toBe(true);
    expect(isPrivateLanIp('192.168.0.50')).toBe(true);
  });

  it('rechaza IPs públicas', () => {
    expect(isPrivateLanIp('8.8.8.8')).toBe(false);
    expect(isPrivateLanIp('203.0.113.10')).toBe(false);
  });
});
