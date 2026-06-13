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

/** Identyfikator drużyny. KONWENCJA: pełna nazwa PL jak w arkuszu
 * (np. "Bośnia i Hercegowina", "Korea Płd."). Dla silnika nieprzezroczysty string;
 * spójność pisowni pilnuje przyszły ingest. "" = brak/nieznana drużyna. */
export type TeamId = string;

/** Końcowe miejsca w grupie: 4 drużyny w kolejności miejsc 1→4. Klucz grupy: "A".."L". */
export type GroupStandings = Record<string, [TeamId, TeamId, TeamId, TeamId]>;

/** Obsada faz pucharowych — zbiory drużyn obecnych w danej fazie. */
export interface PhaseRosters {
  /** 1/16 finału — 32 drużyny. */
  r32: TeamId[];
  /** 1/8 finału — 16 drużyn. */
  r16: TeamId[];
  /** Ćwierćfinał — 8 drużyn. */
  qf: TeamId[];
  /** Półfinał — 4 drużyny. */
  sf: TeamId[];
  /** Finał — 2 drużyny (obaj finaliści). */
  final: TeamId[];
  /** Mistrz — 1 drużyna; "" gdy brak typu. */
  champion: TeamId;
}

/** Komplet rozstrzygnięć K2 — ten sam kształt dla typu uczestnika i dla faktów. */
export interface K2Entry {
  groups: GroupStandings;
  phases: PhaseRosters;
}

/**
 * Punkty K2 jednego uczestnika, rozbite per faza (odwzorowanie H19/H37/H49/H59/H65/H69
 * z arkusza; finał i mistrz rozbite na osobne pola).
 */
export interface K2Score {
  participantId: string;
  /** Grupy: Σ trafionych pozycji × 1 (max 48). */
  group: number;
  /** 1/16: |typ ∩ fakt| × 2. */
  r32: number;
  /** 1/8: × 4. */
  r16: number;
  /** Ćwierćfinał: × 6. */
  qf: number;
  /** Półfinał: × 8. */
  sf: number;
  /** Finał: |typ ∩ fakt| × 10. */
  final: number;
  /** Mistrz: 12 gdy trafiony, inaczej 0. */
  champion: number;
  /** Suma wszystkich składników. */
  total: number;
}
