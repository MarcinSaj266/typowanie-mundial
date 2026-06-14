// CLI alertu nieświeżości (warstwa IO). Czyta tury + dotychczasowe wyniki + mecze z API,
// sprawdza, czy któryś mecz powinien już mieć wynik (FINISHED w API albo dawno po starcie),
// a go nie ma. Wypisuje raport. Exit 0 = czysto, exit 1 = są nieświeże (workflow odpala alert),
// exit 2 = błąd (np. brak tokenu / API padło) — też wart alertu. Token z env FOOTBALL_DATA_TOKEN.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fetchWorldCupMatches } from './footballData';
import { findStaleMatches } from './staleCheck';
import type { TurnFixtures, Results } from './matchScores';

const DATA_DIR = 'data/k1';
const RESULTS = `${DATA_DIR}/results.json`;
const GRACE_MS = 3.5 * 60 * 60 * 1000; // 3,5h od startu: 90 min + przerwy + ewentualna dogrywka/karne + poślizg API

async function main() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    console.error('Brak FOOTBALL_DATA_TOKEN w środowisku.');
    process.exit(2);
  }

  const turns: TurnFixtures[] = readdirSync(DATA_DIR)
    .filter((f) => /^tura-\d+\.json$/.test(f))
    .map((f) => {
      const t = JSON.parse(readFileSync(`${DATA_DIR}/${f}`, 'utf8'));
      return { turn: t.turn, fixtures: t.fixtures } as TurnFixtures;
    })
    .sort((a, b) => a.turn - b.turn);

  const results: Results = existsSync(RESULTS)
    ? JSON.parse(readFileSync(RESULTS, 'utf8'))
    : {};

  const apiMatches = await fetchWorldCupMatches(token);
  const stale = findStaleMatches(turns, results, apiMatches, Date.now(), GRACE_MS);

  if (stale.length === 0) {
    console.log('Brak nieświeżych meczów — wszystko, co powinno mieć wynik, ma wynik.');
    return;
  }

  console.error(`⚠️  ${stale.length} mecz(ów) bez wyniku mimo że powinny już go mieć:`);
  for (const s of stale) {
    const opis =
      s.reason === 'finished-missing'
        ? 'API: FINISHED, a u nas brak (luka mergera — sprawdź teamMap/orientację)'
        : `dawno po starcie (>3,5h), API status=${s.status} (API się spóźnia — sprawdź ręcznie)`;
    console.error(`  • tura ${s.turn}, mecz ${s.no}: ${s.label} — ${opis}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
