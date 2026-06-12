import type { ParticipantSeason, GeneralRow } from './types';
import { rankBy } from './ranking';

/**
 * Buduje tabelę ogólną Konkursu 1: suma = grI + grII + grIII + bns + puch,
 * sortowanie: pkt → % → puch → grI → grII → grIII (reguła organizatora, 2026-06-12;
 * SORTBY w arkuszu „tabela" ma kolejność III→II→I — organizator potwierdził, że to błąd arkusza).
 */
export function generalTable(participants: readonly ParticipantSeason[]): GeneralRow[] {
  const rows = participants.map(p => ({
    ...p,
    points: p.grI + p.grII + p.grIII + p.bns + p.puch,
  }));
  return rankBy(rows, ['points', 'hitRate', 'puch', 'grI', 'grII', 'grIII']).map(r => ({
    ...r,
    total: r.points,
  }));
}
