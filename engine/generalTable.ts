import type { ParticipantSeason, GeneralRow } from './types';
import { rankBy } from './ranking';

/**
 * Buduje tabelę ogólną Konkursu 1: suma = grI + grII + grIII + bns + puch,
 * sortowanie wg `SORTBY` z arkusza „tabela": pkt → % → puch → grIII → grII → grI.
 */
export function generalTable(participants: readonly ParticipantSeason[]): GeneralRow[] {
  const rows = participants.map(p => ({
    ...p,
    points: p.grI + p.grII + p.grIII + p.bns + p.puch,
  }));
  return rankBy(rows, ['points', 'hitRate', 'puch', 'grIII', 'grII', 'grI']).map(r => ({
    ...r,
    total: r.points,
  }));
}
