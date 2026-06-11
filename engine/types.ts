// Typy kanoniczne silnika punktacji. Jedyne źródło prawdy o kształcie danych.

/** Wynik meczu / typ uczestnika: bramki gospodarzy i gości. */
export interface Score {
  home: number;
  away: number;
}

/** Punkty za pojedynczy mecz Konkursu 1 (faza grupowa). */
export type MatchPoints = 0 | 3 | 4 | 5;

/** Pojedynczy mecz w turze: typ uczestnika i faktyczny wynik (null = brak). */
export interface MatchEntry {
  /** Typ uczestnika; null = uczestnik nie wytypował meczu. */
  prediction: Score | null;
  /** Faktyczny wynik; null = mecz jeszcze nierozegrany. */
  result: Score | null;
}

/** Wynik agregacji jednej tury uczestnika. */
export interface TurnScore {
  /** Suma punktów = #3×3 + #4×4 + #5×5. */
  points: number;
  count0: number;
  count3: number;
  count4: number;
  count5: number;
  /** Liczba rozegranych meczów (z wynikiem). */
  played: number;
  /** „%" = (count3+count4+count5) / played; 0 gdy played=0. */
  hitRate: number;
}

/** Wiersz wejściowy do rankingu (tabela grupowa lub ogólna). */
export interface RankableRow {
  participantId: string;
  /** Punkty będące podstawą sortowania. */
  points: number;
  /** „%" — pierwszy tiebreaker. */
  hitRate: number;
  /** Liczba dokładnych wyników (5) — drugi tiebreaker. */
  exactCount: number;
  /** Liczba „4" — trzeci tiebreaker. */
  fourCount: number;
}

/** Wiersz po rankingu z przypisaną pozycją (1 = najlepszy). */
export interface RankedRow extends RankableRow {
  position: number;
}

/** Dorobek uczestnika w całej fazie grupowej + komponenty tabeli ogólnej. */
export interface ParticipantSeason {
  participantId: string;
  grI: number;
  grII: number;
  grIII: number;
  /** Bonus grupowy — domyślnie 0 (moduł konfigurowalny w przyszłości). */
  bns: number;
  /** Faza pucharowa — domyślnie 0 (poza zakresem tego planu). */
  puch: number;
  /** Tiebreakery sezonowe (zagregowane ze wszystkich tur). */
  hitRate: number;
  exactCount: number;
  fourCount: number;
}

/** Wiersz tabeli ogólnej: ranking + jawna suma. */
export interface GeneralRow extends RankedRow {
  /** Suma = grI + grII + grIII + bns + puch (= points). */
  total: number;
}
