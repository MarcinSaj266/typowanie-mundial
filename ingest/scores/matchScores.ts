// Czysta funkcja sklejająca wyniki z API z naszymi fixture'ami (sedno modułu, pod TDD).
// Nie wie o sieci ani o plikach — dostaje gotowe dane wejściowe, zwraca scalone wyniki.
import { toApiName } from './teamMap';

export interface Fixture {
  no: number;
  home: string; // nazwa PL (jak w naszych fixture'ach)
  away: string;
}

export interface TurnFixtures {
  turn: number;
  fixtures: Fixture[];
}

export interface ApiMatch {
  home: string; // nazwa EN (jak z football-data.org)
  away: string;
  homeGoals: number | null;
  awayGoals: number | null;
  status: string;
  utcDate?: string;
  // Pola pucharowe (opcjonalne — merge grupowy ich nie używa). Semantyka zweryfikowana
  // spikiem na żywym API (scripts/spikePuchar.ts, 2026-07-05):
  // - fullTime przy karnych ZAWIERA bramki z konkursu karnych → wynik po 120' = regularTime+extraTime;
  // - extraTime = bramki strzelone TYLKO w dogrywce (nie narastająco).
  stage?: string; // GROUP_STAGE | LAST_32 | LAST_16 | QUARTER_FINALS | SEMI_FINALS | THIRD_PLACE | FINAL
  duration?: string; // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT
  winner?: string | null; // HOME_TEAM | AWAY_TEAM | DRAW | null
  regularTime?: { home: number | null; away: number | null } | null;
  extraTime?: { home: number | null; away: number | null } | null;
  penalties?: { home: number | null; away: number | null } | null;
}

export type Score = { home: number; away: number };
export type Results = Record<string, Record<string, Score>>;

export interface Added {
  turn: number;
  no: number;
  home: number;
  away: number;
  label: string;
}

export interface MergeResult {
  results: Results;
  added: Added[];
}

/** Klucz nieuporządkowanej pary drużyn (orientacja gospodarz/gość bez znaczenia). */
const pairKey = (a: string, b: string) => [a, b].sort().join(' :: ');

/**
 * Dokleja do `existing` wyniki rozegranych (FINISHED) meczów z API, dopasowane po parze
 * drużyn do naszych fixture'ów. Istniejące wpisy są nietykalne (ręczna nadpiska wygrywa).
 * Wynik zapisywany w orientacji NASZEGO fixture'a (gospodarz/gość).
 */
export function mergeScores(
  turns: TurnFixtures[],
  existing: Results,
  apiMatches: ApiMatch[],
): MergeResult {
  // Indeks rozegranych meczów z API po parze drużyn.
  const finished = new Map<string, ApiMatch>();
  for (const m of apiMatches) {
    if (m.status !== 'FINISHED') continue;
    if (m.homeGoals == null || m.awayGoals == null) continue;
    finished.set(pairKey(m.home, m.away), m);
  }

  // Głęboka kopia istniejących wyników — nie mutujemy wejścia.
  const results: Results = JSON.parse(JSON.stringify(existing));
  const added: Added[] = [];

  for (const { turn, fixtures } of turns) {
    for (const fx of fixtures) {
      const turnKey = String(turn);
      const noKey = String(fx.no);

      // Ręczna nadpiska / już wpisane — nie ruszamy.
      if (results[turnKey]?.[noKey]) continue;

      const homeApi = toApiName(fx.home);
      const awayApi = toApiName(fx.away);
      const match = finished.get(pairKey(homeApi, awayApi));
      if (!match) continue;

      // Orientacja: ustaw wynik względem NASZEGO gospodarza.
      const sameOrientation = match.home === homeApi;
      const home = sameOrientation ? match.homeGoals! : match.awayGoals!;
      const away = sameOrientation ? match.awayGoals! : match.homeGoals!;

      (results[turnKey] ??= {})[noKey] = { home, away };
      added.push({
        turn,
        no: fx.no,
        home,
        away,
        label: `${fx.home} ${home}:${away} ${fx.away}`,
      });
    }
  }

  return { results, added };
}
