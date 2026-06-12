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
  ...over,
});

describe('generalTable', () => {
  it('sumuje grI+grII+grIII i rankuje malejąco po sumie', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, grII: 12, grIII: 8 }), // 30
      season({ participantId: 'b', grI: 20, grII: 5, grIII: 9 }), // 34
    ]);
    expect(out[0].participantId).toBe('b');
    expect(out[0].total).toBe(34);
    expect(out[0].points).toBe(34);
    expect(out[0].position).toBe(1);
    expect(out[1].total).toBe(30);
  });

  it('uwzględnia bns i puch w sumie', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, bns: 15, puch: 6 }),
    ]);
    expect(out[0].total).toBe(31); // 10 + 0 + 0 + 15 + 6
  });

  it('przy remisie sumy decyduje wyższy %', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, hitRate: 0.4 }),
      season({ participantId: 'b', grI: 10, hitRate: 0.6 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['b', 'a']);
  });

  it('przy remisie sumy i % decyduje puch, potem grI → grII → grIII (reguła organizatora)', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, hitRate: 0.5 }), // suma 10, puch 0, grI 10
      season({ participantId: 'b', grI: 6, puch: 4, hitRate: 0.5 }), // suma 10, puch 4
      season({ participantId: 'c', grI: 5, grIII: 5, hitRate: 0.5 }), // suma 10, puch 0, grI 5
    ]);
    // b wygrywa na puch; wśród a/c (puch 0) decyduje grI: a (10) > c (5),
    // mimo że c ma wyższe grIII — dorobek wcześniejszej tury ma pierwszeństwo.
    expect(out.map(r => r.participantId)).toEqual(['b', 'a', 'c']);
  });
});
