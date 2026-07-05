// Spike (Etap B robota pucharowego): zrzut SUROWYCH pól `stage` + `score` z football-data.org
// dla meczów fazy pucharowej MŚ 2026. Jednorazowe narzędzie diagnostyczne — rozstrzyga:
//  - jakie wartości przyjmuje `score.duration` (REGULAR / EXTRA_TIME / PENALTY_SHOOTOUT?),
//  - czy `score.fullTime` przy karnych zawiera bramki z konkursu rzutów karnych,
//  - czy darmowy plan zwraca `score.regularTime` / `extraTime` / `penalties` / `winner`.
// Uruchomienie: FOOTBALL_DATA_TOKEN w env → `npx tsx scripts/spikePuchar.ts`
// (lokalnie albo przez workflow_dispatch `.github/workflows/spike-puchar.yml`).

const KNOCKOUT_STAGES = new Set([
  'LAST_32',
  'LAST_16',
  'QUARTER_FINALS',
  'SEMI_FINALS',
  'THIRD_PLACE',
  'FINAL',
]);

interface RawMatch {
  stage?: string;
  status?: string;
  utcDate?: string;
  homeTeam?: { name?: string };
  awayTeam?: { name?: string };
  score?: unknown;
}

async function main() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    console.error('Brak zmiennej środowiskowej FOOTBALL_DATA_TOKEN.');
    process.exit(1);
  }

  const res = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
    headers: { 'X-Auth-Token': token },
  });
  if (!res.ok) {
    throw new Error(`football-data.org HTTP ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { matches?: RawMatch[] };
  if (!data.matches) throw new Error('Odpowiedź API nie zawiera pola "matches".');

  const stages = new Map<string, number>();
  for (const m of data.matches) {
    stages.set(m.stage ?? '?', (stages.get(m.stage ?? '?') ?? 0) + 1);
  }
  console.log('=== stage → liczba meczów ===');
  for (const [stage, n] of stages) console.log(`${stage}: ${n}`);

  console.log('\n=== mecze pucharowe (surowy score) ===');
  for (const m of data.matches) {
    if (!KNOCKOUT_STAGES.has(m.stage ?? '')) continue;
    console.log(
      JSON.stringify({
        stage: m.stage,
        status: m.status,
        utcDate: m.utcDate,
        home: m.homeTeam?.name ?? null,
        away: m.awayTeam?.name ?? null,
        score: m.score,
      }),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
