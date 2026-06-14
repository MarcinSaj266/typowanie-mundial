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

  it('przy pełnym remisie wszystkich kluczy rozstrzyga alfabetycznie wg nicka (jak arkusz organizatora)', () => {
    // Realny przypadek ze zrzutu tabeli ogólnej: wielu graczy 11 pkt / 38%, reszta 0.
    // Organizator ustawia ich alfabetycznie, niezależnie od kolejności w rosterze.
    const out = generalTable([
      season({ participantId: 'KasiaJ', grI: 11, hitRate: 0.38 }),
      season({ participantId: 'DeDe', grI: 11, hitRate: 0.38 }),
      season({ participantId: 'Karolina', grI: 11, hitRate: 0.38 }),
    ]);
    expect(out.map(r => r.participantId)).toEqual(['DeDe', 'Karolina', 'KasiaJ']);
  });

  it('przy remisie sumy i % decyduje puch, potem grIII → grII → grI (reguła organizatora 2026-06-13)', () => {
    const out = generalTable([
      season({ participantId: 'a', grI: 10, hitRate: 0.5 }), // suma 10, puch 0, grIII 0
      season({ participantId: 'b', grI: 6, puch: 4, hitRate: 0.5 }), // suma 10, puch 4
      season({ participantId: 'c', grI: 5, grIII: 5, hitRate: 0.5 }), // suma 10, puch 0, grIII 5
    ]);
    // b wygrywa na puch; wśród a/c (puch 0) decyduje grIII: c (5) > a (0),
    // mimo że a ma wyższe grI — późniejsza tura ma pierwszeństwo.
    expect(out.map(r => r.participantId)).toEqual(['b', 'c', 'a']);
  });
});
