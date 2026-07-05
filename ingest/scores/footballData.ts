// Klient football-data.org (warstwa IO/sieć). Pobiera mecze MŚ i normalizuje do ApiMatch.
// Token wyłącznie z env FOOTBALL_DATA_TOKEN — nigdy w kodzie/repo.
// Pojedynczy `fetch` bywa przejściowo zawodny na runnerach GitHub Actions (sporadyczne
// "fetch failed" — ~1/30 biegów), co wywalało cały robot. Dlatego ponawiamy z backoffem.
import type { ApiMatch } from './matchScores';

const URL = 'https://api.football-data.org/v4/competitions/WC/matches';

interface RawGoals {
  home: number | null;
  away: number | null;
}

interface RawMatch {
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  // Pola score wg spike'a (scripts/spikePuchar.ts, 2026-07-05): przy karnych fullTime
  // ZAWIERA bramki z konkursu karnych; regularTime/extraTime/penalties tylko po dogrywce.
  score?: {
    fullTime?: RawGoals;
    winner?: string | null;
    duration?: string;
    regularTime?: RawGoals | null;
    extraTime?: RawGoals | null;
    penalties?: RawGoals | null;
  };
  stage?: string;
  status?: string;
  utcDate?: string;
}

export interface RetryOpts {
  /** Liczba PONOWNYCH prób po pierwszej (domyślnie 3 → max 4 wywołania). */
  retries?: number;
  /** Bazowe opóźnienie; rośnie wykładniczo: base, 2×base, 4×base… (domyślnie 800 ms). */
  baseDelayMs?: number;
  /** Wstrzykiwane dla testów; domyślnie realny setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Wołane przed każdym ponowieniem (logowanie diagnostyczne). */
  onRetry?: (err: unknown, attempt: number) => void;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const msg = (e: unknown) => {
  if (e instanceof Error) {
    // undici chowa prawdziwą przyczynę w err.cause — pokaż ją.
    const cause = (e as { cause?: unknown }).cause;
    return cause ? `${e.message} (cause: ${cause instanceof Error ? cause.message : String(cause)})` : e.message;
  }
  return String(e);
};

/**
 * Ponawia `fn` przy błędach przejściowych z wykładniczym backoffem.
 * Błędy oznaczone `retryable === false` (np. zły token, HTTP 4xx) NIE są ponawiane.
 */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const { retries = 3, baseDelayMs = 800, sleep = defaultSleep, onRetry } = opts;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const nonRetryable =
        typeof err === 'object' && err !== null && (err as { retryable?: unknown }).retryable === false;
      if (attempt === retries || nonRetryable) break;
      onRetry?.(err, attempt + 1);
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw lastErr;
}

interface FetchOpts {
  fetchImpl?: typeof fetch;
  retry?: RetryOpts;
}

/** Jedno pobranie + walidacja odpowiedzi. HTTP 4xx (poza 429) oznaczamy jako trwałe. */
async function fetchOnce(token: string, fetchImpl: typeof fetch): Promise<ApiMatch[]> {
  const res = await fetchImpl(URL, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`football-data.org HTTP ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
    // 5xx i 429 (limit) to błędy przejściowe — wolno ponawiać; pozostałe 4xx są trwałe.
    (err as { retryable?: boolean }).retryable = res.status >= 500 || res.status === 429;
    throw err;
  }
  const data = (await res.json()) as { matches?: RawMatch[] };
  if (!data.matches) {
    throw new Error('Odpowiedź API nie zawiera pola "matches".');
  }
  return data.matches.map((m) => ({
    home: m.homeTeam?.name ?? '',
    away: m.awayTeam?.name ?? '',
    homeGoals: m.score?.fullTime?.home ?? null,
    awayGoals: m.score?.fullTime?.away ?? null,
    status: m.status ?? '',
    utcDate: m.utcDate,
    stage: m.stage,
    duration: m.score?.duration,
    winner: m.score?.winner ?? undefined,
    regularTime: m.score?.regularTime ?? undefined,
    extraTime: m.score?.extraTime ?? undefined,
    penalties: m.score?.penalties ?? undefined,
  }));
}

/** Pobiera wszystkie mecze MŚ z API (z ponawianiem) i normalizuje do ApiMatch. */
export async function fetchWorldCupMatches(token: string, opts: FetchOpts = {}): Promise<ApiMatch[]> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  return withRetry(() => fetchOnce(token, fetchImpl), {
    onRetry: (err, attempt) =>
      console.warn(`football-data.org: próba ${attempt} nieudana (${msg(err)}) — ponawiam…`),
    ...opts.retry,
  });
}
