// Czysta funkcja wykrywająca "nieświeże" mecze: takie, które wg API już się zakończyły
// (albo dawno minął ich start), a wciąż nie mają wyniku w results.json. Służy do ALERTU —
// żeby przy opóźnieniu API albo cichej luce mergera dostać sygnał, a nie czekać godzinami.
// Nie wie o sieci ani plikach — dostaje gotowe dane, zwraca listę problemów.
import { toApiName } from './teamMap';
import type { TurnFixtures, ApiMatch, Results } from './matchScores';
import type { PucharRoundFixtures, PucharScore } from './matchPucharScores';

export type StaleReason = 'finished-missing' | 'overdue';

export interface StaleMatch {
  turn: number;
  no: number;
  label: string; // "Niemcy vs Curacao"
  reason: StaleReason; // finished-missing = API mówi FINISHED, my nie mamy; overdue = po starcie+grace
  status: string; // status meczu w API
}

/** Klucz nieuporządkowanej pary drużyn (orientacja gospodarz/gość bez znaczenia). */
const pairKey = (a: string, b: string) => [a, b].sort().join(' :: ');

/**
 * Zwraca fixture'y, które powinny już mieć wynik, a go nie mają:
 *  - `finished-missing` — API ma mecz jako FINISHED z wynikiem, a u nas pusto (luka mergera);
 *  - `overdue` — od `utcDate` minęło więcej niż `graceMs`, a wyniku wciąż brak (API się spóźnia).
 * Fixture'y już zapisane w `results` oraz nieznane API są pomijane.
 */
export function findStaleMatches(
  turns: TurnFixtures[],
  results: Results,
  apiMatches: ApiMatch[],
  nowMs: number,
  graceMs: number,
): StaleMatch[] {
  const byPair = new Map<string, ApiMatch>();
  for (const m of apiMatches) byPair.set(pairKey(m.home, m.away), m);

  const stale: StaleMatch[] = [];
  for (const { turn, fixtures } of turns) {
    for (const fx of fixtures) {
      // Już mamy wynik (auto lub ręczny) — nic do zgłoszenia.
      if (results[String(turn)]?.[String(fx.no)]) continue;

      const match = byPair.get(pairKey(toApiName(fx.home), toApiName(fx.away)));
      if (!match) continue; // API nie zna tego meczu — nie da się ocenić.

      const label = `${fx.home} vs ${fx.away}`;
      const finished =
        match.status === 'FINISHED' && match.homeGoals != null && match.awayGoals != null;

      if (finished) {
        stale.push({ turn, no: fx.no, label, reason: 'finished-missing', status: match.status });
      } else if (match.utcDate && nowMs > Date.parse(match.utcDate) + graceMs) {
        stale.push({ turn, no: fx.no, label, reason: 'overdue', status: match.status });
      }
    }
  }
  return stale;
}

export interface StalePucharMatch {
  round: string;
  no: number; // numer GLOBALNY meczu pucharowego
  label: string;
  reason: StaleReason;
  status: string;
}

/** Nasza etykieta rundy → stage w API (lustro ROUND_TO_STAGE z matchPucharScores; tu
 *  tolerancyjnie — nieznana runda po prostu nie jest sprawdzana, alert to nie merger). */
const ROUND_STAGE: Record<string, string> = {
  '1/16': 'LAST_32',
  '1/8': 'LAST_16',
  '1/4': 'QUARTER_FINALS',
  '1/2': 'SEMI_FINALS',
  '3. miejsce': 'THIRD_PLACE',
  finał: 'FINAL',
};

/**
 * Jak `findStaleMatches`, ale dla meczów pucharowych (results.json["puch"]).
 * Dopasowanie po stage + parze drużyn — ta sama para z fazy grupowej się nie łapie.
 */
export function findStalePucharMatches(
  rounds: PucharRoundFixtures[],
  puchResults: Record<string, PucharScore>,
  apiMatches: ApiMatch[],
  nowMs: number,
  graceMs: number,
): StalePucharMatch[] {
  const byStagePair = new Map<string, ApiMatch>();
  for (const m of apiMatches) byStagePair.set(`${m.stage ?? '?'} | ${pairKey(m.home, m.away)}`, m);

  const stale: StalePucharMatch[] = [];
  for (const { round, fixtures } of rounds) {
    const stage = ROUND_STAGE[round];
    if (!stage) continue;
    for (const fx of fixtures) {
      if (puchResults[String(fx.no)]) continue;

      const match = byStagePair.get(`${stage} | ${pairKey(toApiName(fx.home), toApiName(fx.away))}`);
      if (!match) continue;

      const label = `${fx.home} vs ${fx.away}`;
      const finished =
        match.status === 'FINISHED' && match.homeGoals != null && match.awayGoals != null;

      if (finished) {
        stale.push({ round, no: fx.no, label, reason: 'finished-missing', status: match.status });
      } else if (match.utcDate && nowMs > Date.parse(match.utcDate) + graceMs) {
        stale.push({ round, no: fx.no, label, reason: 'overdue', status: match.status });
      }
    }
  }
  return stale;
}
