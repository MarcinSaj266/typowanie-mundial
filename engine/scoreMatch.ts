import type { Score, MatchPoints } from './types';

/** Znak rezultatu: 1 = gospodarz wygrywa, 0 = remis, -1 = goście wygrywają. */
function outcome(s: Score): number {
  return Math.sign(s.home - s.away);
}

/** Różnica bramek (gospodarz − goście). */
function diff(s: Score): number {
  return s.home - s.away;
}

/**
 * Punktacja meczu Konkursu 1 (faza grupowa).
 * 3 za trafiony rezultat, +1 za trafioną różnicę bramek, +1 za dokładny wynik.
 * Zwraca 0 | 3 | 4 | 5 (sekcja 2.1 specyfikacji).
 */
export function scoreMatchK1(typ: Score, wynik: Score): MatchPoints {
  if (outcome(typ) !== outcome(wynik)) {
    return 0;
  }
  if (diff(typ) !== diff(wynik)) {
    return 3;
  }
  if (typ.home === wynik.home && typ.away === wynik.away) {
    return 5;
  }
  return 4;
}
