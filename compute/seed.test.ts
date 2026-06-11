import { describe, it, expect } from 'vitest';
import { seedTurnResults } from './seed';

describe('seedTurnResults', () => {
  it('jest deterministyczny (to samo ziarno = ten sam wynik)', () => {
    expect(seedTurnResults(24, 123)).toEqual(seedTurnResults(24, 123));
  });

  it('generuje komplet meczow 1..N z bramkami calkowitymi 0-4', () => {
    const r = seedTurnResults(24, 123);
    expect(Object.keys(r)).toHaveLength(24);
    for (let no = 1; no <= 24; no++) {
      const s = r[String(no)];
      expect(Number.isInteger(s.home)).toBe(true);
      expect(s.home).toBeGreaterThanOrEqual(0);
      expect(s.home).toBeLessThanOrEqual(4);
      expect(Number.isInteger(s.away)).toBe(true);
      expect(s.away).toBeGreaterThanOrEqual(0);
      expect(s.away).toBeLessThanOrEqual(4);
    }
  });

  it('rozne ziarna daja rozne wyniki', () => {
    expect(seedTurnResults(24, 1)).not.toEqual(seedTurnResults(24, 2));
  });
});
