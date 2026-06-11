import { describe, it, expect } from 'vitest';
import { rankBy } from './ranking';

interface Row {
  participantId: string;
  points: number;
  hitRate: number;
  grIII: number;
}

const row = (over: Partial<Row> & { participantId: string }): Row => ({
  points: 0,
  hitRate: 0,
  grIII: 0,
  ...over,
});

describe('rankBy', () => {
  it('sortuje malejąco po pierwszym kluczu i przypisuje pozycje', () => {
    const out = rankBy(
      [row({ participantId: 'a', points: 10 }), row({ participantId: 'b', points: 20 })],
      ['points'],
    );
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
    expect(out[0].position).toBe(1);
    expect(out[1].position).toBe(2);
  });

  it('stosuje kolejne klucze jako tiebreakery w podanej kolejności', () => {
    const out = rankBy(
      [
        row({ participantId: 'a', points: 10, hitRate: 0.5, grIII: 2 }),
        row({ participantId: 'b', points: 10, hitRate: 0.6, grIII: 0 }),
        row({ participantId: 'c', points: 10, hitRate: 0.5, grIII: 9 }),
      ],
      ['points', 'hitRate', 'grIII'],
    );
    // b ma najwyższy %; przy remisie % decyduje grIII: c (9) > a (2).
    expect(out.map(r => r.participantId)).toEqual(['b', 'c', 'a']);
  });

  it('kolejność kluczy ma znaczenie — inny porządek daje inny wynik', () => {
    const rows = [
      row({ participantId: 'a', hitRate: 0.9, grIII: 1 }),
      row({ participantId: 'b', hitRate: 0.1, grIII: 9 }),
    ];
    expect(rankBy(rows, ['hitRate']).map(r => r.participantId)).toEqual(['a', 'b']);
    expect(rankBy(rows, ['grIII']).map(r => r.participantId)).toEqual(['b', 'a']);
  });

  it('nie mutuje tablicy wejściowej', () => {
    const input = [
      row({ participantId: 'a', points: 10 }),
      row({ participantId: 'b', points: 20 }),
    ];
    rankBy(input, ['points']);
    expect(input.map(r => r.participantId)).toEqual(['a', 'b']);
  });
});
