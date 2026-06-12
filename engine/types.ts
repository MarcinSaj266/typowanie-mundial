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

/** Dorobek uczestnika w całej fazie grupowej + komponenty tabeli ogólnej. */
export interface ParticipantSeason {
  participantId: string;
  grI: number;
  grII: number;
  grIII: number;
  /** Bonus grupowy (groupBonus) — 0 do zakończenia fazy grupowej. */
  bns: number;
  /** Faza pucharowa — domyślnie 0 (poza zakresem tego planu). */
  puch: number;
  /**
   * Sezonowe „%" = łączne trafienia / łączne rozegrane (sekcja 2.2; w Excelu
   * `SUM(S:V)/N1` w arkuszu „tabela"). Pierwszy tiebreaker po punktach.
   */
  hitRate: number;
}

/**
 * Wiersz tabeli ogólnej: dorobek sezonowy + policzona suma i pozycja.
 * Tiebreakery (reguła organizatora, 2026-06-12): pkt → % → puch → grI → grII → grIII.
 */
export interface GeneralRow extends ParticipantSeason {
  /** Suma punktów = grI + grII + grIII + bns + puch. */
  points: number;
  /** Pozycja w tabeli (1 = najlepszy). */
  position: number;
  /** Jawna suma do wyświetlenia (= points). */
  total: number;
}
