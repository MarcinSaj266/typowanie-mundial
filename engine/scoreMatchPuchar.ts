import type { Score } from './types';
import { scoreMatchK1 } from './scoreMatch';

/** Strona meczu — zwycięzca karnych / krzyżyk uczestnika. */
export type Side = 'home' | 'away';

/** Punkty za mecz fazy pucharowej: kategorie bazowe {0,3,4,5,6} podwojone. */
export type PucharPoints = 0 | 6 | 8 | 10 | 12;

/** Rozstrzygnięcie karnych: faktyczny zwycięzca + krzyżyk uczestnika (null = nie postawił). */
export interface Karne {
  zwyciezca: Side;
  typ: Side | null;
}

/**
 * Punktacja meczu fazy pucharowej (reguła organizatora, 2026-06-12):
 * wynik po dogrywce liczy się jak wynik z 90 min, punktacja bazowa jak w grupie
 * (scoreMatchK1), całość ×2 → {0,6,8,10,12}.
 *
 * Karne (gdy wynik po dogrywce to remis): kto typował remis, obowiązkowo wskazuje
 * zwycięzcę karnych krzyżykiem — trafiony +1, nietrafiony (lub brak krzyżyka) −1
 * do wartości bazowej PRZED podwojeniem: dokładny remis 5±1, remis bez dokładnego
 * wyniku 4±1. Zgodne z `rpuch` (COUNTIF po 6/8/10/12 — wartości meczowe parzyste).
 * Kategoria bazowa do statystyk „%" = punkty/2.
 */
export function scoreMatchPuchar(typ: Score, wynik: Score, karne?: Karne): PucharPoints {
  const base = scoreMatchK1(typ, wynik);
  if (wynik.home !== wynik.away) {
    return (base * 2) as PucharPoints;
  }
  if (!karne) {
    throw new Error('Mecz pucharowy zakończony remisem wymaga danych o karnych.');
  }
  if (base === 0) {
    return 0;
  }
  // Trafiony remis to zawsze trafiona różnica (0), więc base ∈ {4,5}.
  return ((base + (karne.typ === karne.zwyciezca ? 1 : -1)) * 2) as PucharPoints;
}
