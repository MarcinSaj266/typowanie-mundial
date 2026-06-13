import type { GroupStandings, K2Entry, K2Score, TeamId } from './types';

/** Wagi punktowe faz pucharowych (obecność drużyny w fazie). */
const PHASE_WEIGHT = { r32: 2, r16: 4, qf: 6, sf: 8, final: 10 } as const;

/** Liczba drużyn na trafionym miejscu w grupach (1 pkt każda). */
function groupHits(typ: GroupStandings, fakt: GroupStandings): number {
  let hits = 0;
  for (const [group, teams] of Object.entries(fakt)) {
    const typed = typ[group];
    if (!typed) continue;
    teams.forEach((team, i) => {
      if (team !== '' && typed[i] === team) hits += 1;
    });
  }
  return hits;
}

/** Liczność przecięcia dwóch zbiorów drużyn (po nazwie; defensywnie bez duplikatów). */
function intersectionSize(typ: readonly TeamId[], fakt: readonly TeamId[]): number {
  const typed = new Set(typ);
  const seen = new Set<TeamId>();
  let n = 0;
  // Pustkę ("") pomijamy po stronie fakt (brak danych = nie trafia); to jedyne
  // miejsce egzekwowania tej zasady — "" w typ jest nieszkodliwe, bo bez
  // dopasowania w fakt nigdy nie wejdzie do licznika.
  for (const team of fakt) {
    if (team !== '' && typed.has(team) && !seen.has(team)) {
      seen.add(team);
      n += 1;
    }
  }
  return n;
}

/**
 * Punktacja Konkursu 2 dla jednego uczestnika (czysta). Wariant A:
 * dostaje gotowe, rozwiązane zbiory; nie zna drabinki ani Excela.
 * Grupy: 1 pkt za trafione miejsce. Fazy: przecięcie zbiorów × waga,
 * kumulowane. Mistrz: 12 za trafienie. Patrz spec 2026-06-13.
 */
export function scoreK2(participantId: string, typ: K2Entry, fakt: K2Entry): K2Score {
  const group = groupHits(typ.groups, fakt.groups);
  const r32 = intersectionSize(typ.phases.r32, fakt.phases.r32) * PHASE_WEIGHT.r32;
  const r16 = intersectionSize(typ.phases.r16, fakt.phases.r16) * PHASE_WEIGHT.r16;
  const qf = intersectionSize(typ.phases.qf, fakt.phases.qf) * PHASE_WEIGHT.qf;
  const sf = intersectionSize(typ.phases.sf, fakt.phases.sf) * PHASE_WEIGHT.sf;
  const final = intersectionSize(typ.phases.final, fakt.phases.final) * PHASE_WEIGHT.final;
  const champion =
    typ.phases.champion !== '' && typ.phases.champion === fakt.phases.champion ? 12 : 0;
  const total = group + r32 + r16 + qf + sf + final + champion;
  return { participantId, group, r32, r16, qf, sf, final, champion, total };
}
