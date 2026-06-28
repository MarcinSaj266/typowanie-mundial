import { scoreMatchPuchar, type Karne, type PucharPoints } from './scoreMatchPuchar';
import type { PucharPick, PucharResult } from './types';

/** Jeden mecz pucharowy do agregacji: typ uczestnika i faktyczny wynik (null = brak). */
export interface PucharEntry {
  prediction: PucharPick | null;
  result: PucharResult | null;
}

/** Wynik agregacji fazy pucharowej uczestnika. */
export interface PucharAgg {
  /** Suma punktów pucharowych. */
  puch: number;
  count6: number;
  count8: number;
  count10: number;
  count12: number;
  /** Mecze rozegrane (z typem i policzalnym wynikiem). */
  played: number;
}

/**
 * Punkty jednego meczu pucharowego z typu i wyniku. Buduje `Karne` gdy wynik jest remisem
 * (zwycięzca = `result.pk`, krzyżyk uczestnika = `pick.pk ?? null`). Zwraca `null`, gdy wynik
 * to remis bez `result.pk` (nie wiadomo, kto wygrał karne) — taki mecz nie jest punktowany.
 */
export function scorePucharMatch(pick: PucharPick, result: PucharResult): PucharPoints | null {
  if (result.home === result.away) {
    if (result.pk === undefined) return null;
    const karne: Karne = { zwyciezca: result.pk, typ: pick.pk ?? null };
    return scoreMatchPuchar({ home: pick.home, away: pick.away }, { home: result.home, away: result.away }, karne);
  }
  return scoreMatchPuchar({ home: pick.home, away: pick.away }, { home: result.home, away: result.away });
}

/** Agreguje mecze pucharowe uczestnika: suma `puch`, rozkład kategorii {6,8,10,12} i `played`. */
export function aggregatePuchar(entries: PucharEntry[]): PucharAgg {
  const agg: PucharAgg = { puch: 0, count6: 0, count8: 0, count10: 0, count12: 0, played: 0 };
  for (const { prediction, result } of entries) {
    if (!prediction || !result) continue;
    const pts = scorePucharMatch(prediction, result);
    if (pts === null) continue;
    agg.played += 1;
    agg.puch += pts;
    if (pts === 6) agg.count6 += 1;
    else if (pts === 8) agg.count8 += 1;
    else if (pts === 10) agg.count10 += 1;
    else if (pts === 12) agg.count12 += 1;
  }
  return agg;
}
