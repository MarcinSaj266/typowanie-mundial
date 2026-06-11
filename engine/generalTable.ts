import type { ParticipantSeason, RankableRow, GeneralRow } from './types';
import { rankRows } from './ranking';

/**
 * Buduje tabelę ogólną: suma = grI + grII + grIII + bns + puch,
 * ranking wg punktów i tiebreakerów (sekcja 2.2 specyfikacji).
 */
export function generalTable(participants: ParticipantSeason[]): GeneralRow[] {
  const rows: RankableRow[] = participants.map(p => ({
    participantId: p.participantId,
    points: p.grI + p.grII + p.grIII + p.bns + p.puch,
    hitRate: p.hitRate,
    exactCount: p.exactCount,
    fourCount: p.fourCount,
  }));
  return rankRows(rows).map(r => ({ ...r, total: r.points }));
}
