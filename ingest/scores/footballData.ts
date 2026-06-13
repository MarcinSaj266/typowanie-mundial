// Klient football-data.org (warstwa IO/sieć). Pobiera mecze MŚ i normalizuje do ApiMatch.
// Token wyłącznie z env FOOTBALL_DATA_TOKEN — nigdy w kodzie/repo.
import type { ApiMatch } from './matchScores';

const URL = 'https://api.football-data.org/v4/competitions/WC/matches';

interface RawMatch {
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  score?: { fullTime?: { home: number | null; away: number | null } };
  status?: string;
  utcDate?: string;
}

/** Pobiera wszystkie mecze MŚ z API i normalizuje do ApiMatch. */
export async function fetchWorldCupMatches(token: string): Promise<ApiMatch[]> {
  const res = await fetch(URL, { headers: { 'X-Auth-Token': token } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`football-data.org HTTP ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
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
  }));
}
