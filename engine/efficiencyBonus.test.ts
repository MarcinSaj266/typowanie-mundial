import { describe, expect, it } from 'vitest';
import { efficiencyBonus } from './efficiencyBonus';

describe('efficiencyBonus', () => {
  it('brak etapów → brak bonusów', () => {
    expect(efficiencyBonus([])).toEqual({});
  });

  it('jeden kompletny etap → top 3 dostaje 3/2/1, reszta nic', () => {
    const out = efficiencyBonus([
      { complete: true, standings: ['KSZ', 'Mirella', 'MateuszKn', 'KasiaJ', 'Henryk'] },
    ]);
    expect(out).toEqual({ KSZ: 3, Mirella: 2, MateuszKn: 1 });
  });

  it('etap niekompletny → żadnego bonusu', () => {
    const out = efficiencyBonus([
      { complete: false, standings: ['KSZ', 'Mirella', 'MateuszKn'] },
    ]);
    expect(out).toEqual({});
  });

  it('kumuluje bonusy przez kompletne etapy', () => {
    const out = efficiencyBonus([
      { complete: true, standings: ['KSZ', 'Mirella', 'MateuszKn'] }, // 3/2/1
      { complete: true, standings: ['Mirella', 'KSZ', 'Borys'] }, // 3/2/1
    ]);
    expect(out).toEqual({
      KSZ: 3 + 2, // 1. + 2.
      Mirella: 2 + 3, // 2. + 1.
      MateuszKn: 1,
      Borys: 1,
    });
  });

  it('pomija etapy niekompletne, licząc tylko kompletne', () => {
    const out = efficiencyBonus([
      { complete: true, standings: ['A', 'B', 'C'] },
      { complete: false, standings: ['D', 'E', 'F'] },
    ]);
    expect(out).toEqual({ A: 3, B: 2, C: 1 });
  });

  it('krótsza lista niż 3 → bonus tylko dla obecnych', () => {
    const out = efficiencyBonus([{ complete: true, standings: ['A', 'B'] }]);
    expect(out).toEqual({ A: 3, B: 2 });
  });
});
