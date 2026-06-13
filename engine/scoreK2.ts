import type { GroupStandings, K2Entry, K2Score } from './types';

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

/**
 * Punktacja Konkursu 2 dla jednego uczestnika (czysta). Wariant A:
 * dostaje gotowe, rozwiązane zbiory; nie zna drabinki ani Excela.
 */
export function scoreK2(participantId: string, typ: K2Entry, fakt: K2Entry): K2Score {
  const group = groupHits(typ.groups, fakt.groups);
  const total = group;
  return { participantId, group, r32: 0, r16: 0, qf: 0, sf: 0, final: 0, champion: 0, total };
}
