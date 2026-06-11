import type { MatchEntry, TurnScore } from './types';
import { scoreMatchK1 } from './scoreMatch';

/**
 * Agreguje jedną turę uczestnika: sumuje punkty i zlicza kategorie 0/3/4/5.
 * Mecze nierozegrane (result === null) są pomijane.
 * Brak typu (prediction === null) na rozegranym meczu = 0 pkt.
 */
export function aggregateTurn(entries: MatchEntry[]): TurnScore {
  let points = 0;
  let count0 = 0;
  let count3 = 0;
  let count4 = 0;
  let count5 = 0;
  let played = 0;

  for (const entry of entries) {
    if (entry.result === null) {
      continue;
    }
    played += 1;
    const p = entry.prediction === null
      ? 0
      : scoreMatchK1(entry.prediction, entry.result);
    points += p;
    if (p === 0) count0 += 1;
    else if (p === 3) count3 += 1;
    else if (p === 4) count4 += 1;
    else count5 += 1;
  }

  const hits = count3 + count4 + count5;
  return {
    points,
    count0,
    count3,
    count4,
    count5,
    played,
    hitRate: played === 0 ? 0 : hits / played,
  };
}
