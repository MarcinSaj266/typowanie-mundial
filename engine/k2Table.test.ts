import { describe, it, expect } from 'vitest';
import type { K2Score } from './types';
import { k2Table } from './k2Table';

/** Buduje K2Score z zerami + nadpisaniami. */
const sc = (over: Partial<K2Score> & { participantId: string }): K2Score => ({
  group: 0, r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0, total: 0,
  ...over,
});

describe('k2Table', () => {
  it('sortuje malejąco po total i nadaje pozycje', () => {
    const out = k2Table([
      sc({ participantId: 'a', total: 30 }),
      sc({ participantId: 'b', total: 50 }),
      sc({ participantId: 'c', total: 40 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'c', 'a']);
    expect(out.map(r => r.position)).toEqual([1, 2, 3]);
  });

  it('remis total → rozstrzyga punkt z późniejszej fazy', () => {
    // Oba mają total 20: a dzięki półfinałowi, b dzięki 1/16. Późniejsza faza (sf) wygrywa.
    const out = k2Table([
      sc({ participantId: 'b', total: 20, r32: 20 }),
      sc({ participantId: 'a', total: 20, sf: 20 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['a', 'b']);
  });

  it('remis aż do mistrza → mistrz rozstrzyga jako najpóźniejsza faza', () => {
    const out = k2Table([
      sc({ participantId: 'x', total: 12, final: 12 }),
      sc({ participantId: 'y', total: 12, champion: 12 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['y', 'x']);
  });

  it('nie mutuje wejścia', () => {
    const input = [sc({ participantId: 'a', total: 10 }), sc({ participantId: 'b', total: 20 })];
    k2Table(input);
    expect(input.map(r => r.participantId)).toEqual(['a', 'b']);
  });
});
