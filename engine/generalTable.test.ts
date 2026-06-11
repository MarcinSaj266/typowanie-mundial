import { describe, it, expect } from 'vitest';
import { generalTable } from './generalTable';
import type { ParticipantSeason } from './types';

const season = (
  over: Partial<ParticipantSeason> & { participantId: string },
): ParticipantSeason => ({
  grI: 0,
  grII: 0,
  grIII: 0,
  bns: 0,
  puch: 0,
  hitRate: 0,
  exactCount: 0,
  fourCount: 0,
  ...over,
});

describe('generalTable', () => {
  it('sumuje grI+grII+grIII i rankuje malejąco po sumie', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, grII: 12, grIII: 8 }),  // 30
      season({ participantId: 'b', grI: 20, grII: 5, grIII: 9 }),   // 34
    ]);
    expect(out[0].participantId).toBe('b');
    expect(out[0].total).toBe(34);
    expect(out[0].position).toBe(1);
    expect(out[1].total).toBe(30);
  });

  it('uwzględnia bns i puch w sumie', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, bns: 15, puch: 6 }),
    ]);
    expect(out[0].total).toBe(31); // 10 + 0 + 0 + 15 + 6
  });

  it('przy remisie sumy stosuje tiebreakery (%, dokładne, 4)', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, hitRate: 0.4, exactCount: 1 }),
      season({ participantId: 'b', grI: 10, hitRate: 0.6, exactCount: 1 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
  });
});
