import { describe, it, expect } from 'vitest';
import type { K2Entry } from './types';
import { scoreK2 } from './scoreK2';

/** Pusta obsada faz — używana, gdy test sprawdza tylko grupy. */
const emptyPhases = () => ({ r32: [], r16: [], qf: [], sf: [], final: [], champion: '' });

/** Buduje K2Entry z podanymi grupami i (opcjonalnie) fazami. */
const entry = (groups: K2Entry['groups'], phases: Partial<K2Entry['phases']> = {}): K2Entry => ({
  groups,
  phases: { ...emptyPhases(), ...phases },
});

describe('scoreK2 — grupy', () => {
  it('1 pkt za każdą drużynę na trafionym miejscu', () => {
    const typ = entry({ A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] });
    const fakt = entry({ A: ['Meksyk', 'Czechy', 'Korea Płd.', 'RPA'] });
    // Trafione: Meksyk (1), RPA (4) → 2 pkt. Korea/Czechy zamienione.
    expect(scoreK2('p1', typ, fakt).group).toBe(2);
  });

  it('komplet 12 grup po 4 trafienia → 48 pkt', () => {
    const groups: K2Entry['groups'] = {};
    for (const g of 'ABCDEFGHIJKL') {
      groups[g] = [`${g}1`, `${g}2`, `${g}3`, `${g}4`];
    }
    const e = entry(groups);
    const score = scoreK2('p1', e, e);
    expect(score.group).toBe(48);
    expect(score.total).toBe(48);
  });

  it('grupa nieobecna w typie nie daje punktów', () => {
    const typ = entry({});
    const fakt = entry({ A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] });
    expect(scoreK2('p1', typ, fakt).group).toBe(0);
  });

  it('puste miejsce w faktach ("") nie liczy się nawet przy "" w typie', () => {
    const typ = entry({ A: ['', 'Korea Płd.', 'Czechy', 'RPA'] });
    const fakt = entry({ A: ['', 'Korea Płd.', 'Czechy', 'RPA'] });
    // Pozycja 1 to "" w obu — NIE punktujemy; pozostałe 3 trafione.
    expect(scoreK2('p1', typ, fakt).group).toBe(3);
  });

  it('grupa nieobecna w faktach nie daje punktów', () => {
    const typ = entry({ A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] });
    const fakt = entry({});
    expect(scoreK2('p1', typ, fakt).group).toBe(0);
  });
});

describe('scoreK2 — fazy pucharowe', () => {
  const noGroups = {} as K2Entry['groups'];

  it('każda faza punktuje przecięcie zbiorów swoją wagą', () => {
    const typ = entry(noGroups, {
      r32: ['A', 'B', 'C'],
      r16: ['A', 'B'],
      qf: ['A', 'X'],
      sf: ['A'],
      final: ['A', 'Y'],
    });
    const fakt = entry(noGroups, {
      r32: ['A', 'B', 'Z'],
      r16: ['A', 'Q'],
      qf: ['A'],
      sf: ['A'],
      final: ['A', 'W'],
    });
    const s = scoreK2('p1', typ, fakt);
    expect(s.r32).toBe(2 * 2); // A,B
    expect(s.r16).toBe(1 * 4); // A
    expect(s.qf).toBe(1 * 6); // A
    expect(s.sf).toBe(1 * 8); // A
    expect(s.final).toBe(1 * 10); // A
  });

  it('mistrz: 12 gdy trafiony, 0 gdy nie', () => {
    const fakt = entry(noGroups, { champion: 'A' });
    expect(scoreK2('p1', entry(noGroups, { champion: 'A' }), fakt).champion).toBe(12);
    expect(scoreK2('p1', entry(noGroups, { champion: 'B' }), fakt).champion).toBe(0);
  });

  it('pusty typ mistrza ("") nie trafia w pustego mistrza faktów', () => {
    const fakt = entry(noGroups, { champion: '' });
    expect(scoreK2('p1', entry(noGroups, { champion: '' }), fakt).champion).toBe(0);
  });

  it('kumulacja: drużyna typowana od 1/16 do tytułu → 2+4+6+8+10+12 = 42', () => {
    const e = entry(noGroups, {
      r32: ['A'], r16: ['A'], qf: ['A'], sf: ['A'], final: ['A'], champion: 'A',
    });
    const s = scoreK2('p1', e, e);
    expect(s.total).toBe(2 + 4 + 6 + 8 + 10 + 12);
  });

  it('total = suma wszystkich składników (grupy + fazy)', () => {
    const typ = entry(
      { A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] },
      { r32: ['A'], final: ['A', 'B'], champion: 'A' },
    );
    const fakt = entry(
      { A: ['Meksyk', 'Korea Płd.', 'Czechy', 'RPA'] },
      { r32: ['A'], final: ['A', 'C'], champion: 'A' },
    );
    const s = scoreK2('p1', typ, fakt);
    expect(s.group).toBe(4);
    expect(s.r32).toBe(2);
    expect(s.final).toBe(10);
    expect(s.champion).toBe(12);
    expect(s.total).toBe(4 + 2 + 10 + 12);
  });
});
