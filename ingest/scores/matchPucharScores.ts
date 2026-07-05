// Czysta funkcja sklejająca wyniki PUCHAROWE z API z naszymi rundami (sedno Etapu B, pod TDD).
// Nie wie o sieci ani o plikach. Reguły konkursu: dogrywka liczy się jak wynik z 90 minut;
// karne → zapisujemy remis po 120' + zwycięzcę karnych w polu `pk`.
//
// Dopasowanie: `stage` z API + nieuporządkowana para drużyn. W drabince para jest unikalna
// w obrębie rundy, a kolizję z powtórką pary z fazy grupowej odcina filtr po stage.
//
// Semantyka pól API (zweryfikowana spikiem scripts/spikePuchar.ts, 2026-07-05):
// - duration REGULAR / EXTRA_TIME → fullTime to wynik końcowy (po 90' / po 120');
// - duration PENALTY_SHOOTOUT → fullTime ZAWIERA bramki karnych! Wynik po 120' =
//   regularTime + extraTime; zwycięzca karnych = winner (HOME_TEAM/AWAY_TEAM).
import { toApiName } from './teamMap';
import type { ApiMatch } from './matchScores';

export interface PucharFixture {
  no: number; // numer GLOBALNY meczu pucharowego (1–16 = 1/16, 17–24 = 1/8, …)
  home: string; // nazwa PL (jak w data/k1/puchar.json)
  away: string;
}

export interface PucharRoundFixtures {
  round: string;
  fixtures: PucharFixture[];
}

export type Side = 'home' | 'away';
export type PucharScore = { home: number; away: number; pk?: Side };

export interface PucharAdded {
  round: string;
  no: number;
  label: string;
}

export interface PucharMergeResult {
  puch: Record<string, PucharScore>;
  added: PucharAdded[];
  warnings: string[];
}

/** Nasza etykieta rundy → stage w football-data.org. Nieznana etykieta = twardy błąd. */
const ROUND_TO_STAGE: Record<string, string> = {
  '1/16': 'LAST_32',
  '1/8': 'LAST_16',
  '1/4': 'QUARTER_FINALS',
  '1/2': 'SEMI_FINALS',
  '3. miejsce': 'THIRD_PLACE',
  finał: 'FINAL',
};

const stageFor = (round: string): string => {
  const stage = ROUND_TO_STAGE[round];
  if (!stage) {
    throw new Error(
      `Nieznana etykieta rundy pucharowej: "${round}" — dopisz mapowanie w ROUND_TO_STAGE.`,
    );
  }
  return stage;
};

/** Klucz nieuporządkowanej pary drużyn (orientacja gospodarz/gość bez znaczenia). */
const pairKey = (a: string, b: string) => [a, b].sort().join(' :: ');

const bothNumbers = (
  t: { home: number | null; away: number | null } | null | undefined,
): t is { home: number; away: number } => t != null && t.home != null && t.away != null;

/**
 * Wyprowadza wpis `PucharScore` (w orientacji API) z zakończonego meczu pucharowego.
 * Zwraca `{ error }` przy niespójności danych (wtedy mecz pomijamy z ostrzeżeniem —
 * dokleimy w kolejnym biegu robota albo ręcznie).
 */
function extractScore(m: ApiMatch): { score?: PucharScore; error?: string } {
  if (m.duration === 'PENALTY_SHOOTOUT') {
    if (!bothNumbers(m.regularTime) || !bothNumbers(m.extraTime)) {
      return { error: 'karne bez regularTime/extraTime w API' };
    }
    const home = m.regularTime.home + m.extraTime.home;
    const away = m.regularTime.away + m.extraTime.away;
    if (home !== away) return { error: `karne, a wynik po 120' nie jest remisem (${home}:${away})` };
    if (m.winner !== 'HOME_TEAM' && m.winner !== 'AWAY_TEAM') {
      return { error: `karne bez zwycięzcy w API (winner=${m.winner ?? 'brak'})` };
    }
    return { score: { home, away, pk: m.winner === 'HOME_TEAM' ? 'home' : 'away' } };
  }

  // REGULAR / EXTRA_TIME: fullTime = wynik końcowy (dogrywka liczy się jak 90 minut).
  if (m.homeGoals == null || m.awayGoals == null) return { error: 'brak wyniku fullTime w API' };
  if (m.homeGoals === m.awayGoals) {
    return { error: `remis (${m.homeGoals}:${m.awayGoals}) bez duration=PENALTY_SHOOTOUT` };
  }
  return { score: { home: m.homeGoals, away: m.awayGoals } };
}

/**
 * Dokleja do `existing` (results.json["puch"]) wyniki rozegranych (FINISHED) meczów pucharowych
 * z API, dopasowane po stage + parze drużyn. Istniejące wpisy są nietykalne (ręczna nadpiska
 * wygrywa). Wynik i `pk` zapisywane w orientacji NASZEGO fixture'a.
 */
export function mergePucharScores(
  rounds: PucharRoundFixtures[],
  existing: Record<string, PucharScore>,
  apiMatches: ApiMatch[],
): PucharMergeResult {
  // Indeks rozegranych meczów z API: stage → para drużyn → mecz.
  const finished = new Map<string, ApiMatch>();
  for (const m of apiMatches) {
    if (m.status !== 'FINISHED') continue;
    finished.set(`${m.stage ?? '?'} | ${pairKey(m.home, m.away)}`, m);
  }

  // Głęboka kopia istniejących wyników — nie mutujemy wejścia.
  const puch: Record<string, PucharScore> = JSON.parse(JSON.stringify(existing));
  const added: PucharAdded[] = [];
  const warnings: string[] = [];

  for (const { round, fixtures } of rounds) {
    const stage = stageFor(round);
    for (const fx of fixtures) {
      const noKey = String(fx.no);

      // Ręczna nadpiska / już wpisane — nie ruszamy.
      if (puch[noKey]) continue;

      const homeApi = toApiName(fx.home);
      const awayApi = toApiName(fx.away);
      const match = finished.get(`${stage} | ${pairKey(homeApi, awayApi)}`);
      if (!match) continue;

      const { score, error } = extractScore(match);
      if (!score) {
        warnings.push(`puchar mecz ${fx.no} (${fx.home}–${fx.away}): ${error} — pomijam`);
        continue;
      }

      // Orientacja: ustaw wynik i pk względem NASZEGO gospodarza.
      const sameOrientation = match.home === homeApi;
      const oriented: PucharScore = sameOrientation
        ? score
        : {
            home: score.away,
            away: score.home,
            ...(score.pk ? { pk: score.pk === 'home' ? ('away' as Side) : ('home' as Side) } : {}),
          };

      puch[noKey] = oriented;
      const pkNote = oriented.pk ? ` (karne: ${oriented.pk === 'home' ? fx.home : fx.away})` : '';
      added.push({
        round,
        no: fx.no,
        label: `${fx.home} ${oriented.home}:${oriented.away} ${fx.away}${pkNote}`,
      });
    }
  }

  return { puch, added, warnings };
}
