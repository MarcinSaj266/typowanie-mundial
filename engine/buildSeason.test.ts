import { describe, it, expect } from 'vitest';
import { buildSeason } from './buildSeason';
import type { TurnScore } from './types';

const turn = (over: Partial<TurnScore>): TurnScore => ({
  points: 0,
  count0: 0,
  count3: 0,
  count4: 0,
  count5: 0,
  played: 0,
  hitRate: 0,
  ...over,
});

describe('buildSeason', () => {
  it('mapuje punkty trzech tur na grI/grII/grIII', () => {
    const s = buildSeason('a', [
      turn({ points: 12 }),
      turn({ points: 7 }),
      turn({ points: 20 }),
    ]);
    expect(s.grI).toBe(12);
    expect(s.grII).toBe(7);
    expect(s.grIII).toBe(20);
    expect(s.participantId).toBe('a');
  });

  it('liczy sezonowe „%" sumarycznie: łączne trafienia / łączne rozegrane', () => {
    // Tura 1: 6 trafień / 24 ; Tura 2: 12 / 24 ; Tura 3: 0 / 0 (nierozegrana).
    const s = buildSeason('a', [
      turn({ count3: 4, count4: 1, count5: 1, played: 24 }), // 6 trafień
      turn({ count3: 8, count4: 2, count5: 2, played: 24 }), // 12 trafień
      turn({ played: 0 }),
    ]);
    // (6 + 12) / (24 + 24) = 18 / 48 = 0.375 — NIE średnia tur (0.25+0.5)/2.
    expect(s.hitRate).toBeCloseTo(18 / 48, 10);
  });

  it('„%" = 0 gdy nic nie rozegrano', () => {
    const s = buildSeason('a', [turn({}), turn({}), turn({})]);
    expect(s.hitRate).toBe(0);
  });

  it('bns i puch domyślnie 0, a podane nadpisują', () => {
    const domyslny = buildSeason('a', [turn({}), turn({}), turn({})]);
    expect(domyslny.bns).toBe(0);
    expect(domyslny.puch).toBe(0);

    const zBonusem = buildSeason('a', [turn({}), turn({}), turn({})], { bns: 15, puch: 6 });
    expect(zBonusem.bns).toBe(15);
    expect(zBonusem.puch).toBe(6);
  });
});
