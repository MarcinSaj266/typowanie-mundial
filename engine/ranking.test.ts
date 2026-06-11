import { describe, it, expect } from 'vitest';
import { rankRows } from './ranking';
import type { RankableRow } from './types';

const row = (over: Partial<RankableRow> & { participantId: string }): RankableRow => ({
  points: 0,
  hitRate: 0,
  exactCount: 0,
  fourCount: 0,
  ...over,
});

describe('rankRows', () => {
  it('sortuje malejąco po punktach i przypisuje pozycje', () => {
    const out = rankRows([
      row({ participantId: 'a', points: 10 }),
      row({ participantId: 'b', points: 20 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
    expect(out[0].position).toBe(1);
    expect(out[1].position).toBe(2);
  });

  it('przy remisie punktowym decyduje wyższy %', () => {
    const out = rankRows([
      row({ participantId: 'a', points: 10, hitRate: 0.4, exactCount: 5, fourCount: 5 }),
      row({ participantId: 'b', points: 10, hitRate: 0.6, exactCount: 1, fourCount: 1 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
  });

  it('przy remisie pkt i % decyduje liczba dokładnych (5), potem liczba 4', () => {
    const out = rankRows([
      row({ participantId: 'a', points: 10, hitRate: 0.5, exactCount: 2, fourCount: 9 }),
      row({ participantId: 'b', points: 10, hitRate: 0.5, exactCount: 3, fourCount: 0 }),
      row({ participantId: 'c', points: 10, hitRate: 0.5, exactCount: 2, fourCount: 1 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a', 'c']);
  });

  it('nie mutuje tablicy wejściowej', () => {
    const input = [
      row({ participantId: 'a', points: 10 }),
      row({ participantId: 'b', points: 20 }),
    ];
    rankRows(input);
    expect(input.map(r => r.participantId)).toEqual(['a', 'b']);
  });
});
