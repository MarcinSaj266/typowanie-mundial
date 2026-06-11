import type { TurnScore, ParticipantSeason } from './types';

/** Opcjonalne komponenty sezonu spoza fazy grupowej. */
export interface SeasonExtras {
  /** Bonus grupowy — domyślnie 0 (moduł konfigurowalny). */
  bns?: number;
  /** Punkty fazy pucharowej — domyślnie 0 (poza zakresem tego planu). */
  puch?: number;
}

/**
 * Składa dorobek uczestnika z trzech tur fazy grupowej (grup I/II/III) w
 * `ParticipantSeason` do tabeli ogólnej.
 *
 * Sezonowe „%" liczone jest sumarycznie: łączne trafienia (#3+#4+#5 ze wszystkich
 * tur) / łączne rozegrane — spójnie z `SUM(S:V)/N1` w arkuszu „tabela" (sekcja 2.2).
 * Faza grupowa nie generuje „6", więc puch i jego wkład w „%" dochodzą osobno
 * wraz z fazą pucharową (poza zakresem tego planu).
 */
export function buildSeason(
  participantId: string,
  turns: readonly [TurnScore, TurnScore, TurnScore],
  extras: SeasonExtras = {},
): ParticipantSeason {
  const [t1, t2, t3] = turns;
  const played = t1.played + t2.played + t3.played;
  const hits =
    t1.count3 + t1.count4 + t1.count5 +
    t2.count3 + t2.count4 + t2.count5 +
    t3.count3 + t3.count4 + t3.count5;
  return {
    participantId,
    grI: t1.points,
    grII: t2.points,
    grIII: t3.points,
    bns: extras.bns ?? 0,
    puch: extras.puch ?? 0,
    hitRate: played === 0 ? 0 : hits / played,
  };
}
