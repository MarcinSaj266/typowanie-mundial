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
});
