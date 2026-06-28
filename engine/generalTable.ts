import type { ParticipantSeason, GeneralRow } from './types';
import { rankBy } from './ranking';

/**
 * Buduje tabelę ogólną Konkursu 1: suma = grI + grII + grIII + bns + puch,
 * sortowanie: pkt → % → puch → grIII → grII → grI → skutBonus (reguła organizatora,
 * 2026-06-13: „im późniejsze punkty, tym większe znaczenie"; skutBonus = ukryty
 * tiebreaker „as z rękawa", aktywny od fazy pucharowej — patrz bonus skuteczności).
 */
export function generalTable(
  participants: readonly (ParticipantSeason & { skutBonus?: number })[],
): GeneralRow[] {
  const rows = participants.map(p => ({
    ...p,
    skutBonus: p.skutBonus ?? 0,
    points: p.grI + p.grII + p.grIII + p.bns + p.puch,
  }));
  return rankBy(rows, ['points', 'hitRate', 'puch', 'grIII', 'grII', 'grI', 'skutBonus']).map(r => ({
    ...r,
    total: r.points,
  }));
}
