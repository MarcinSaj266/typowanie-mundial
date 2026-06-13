// CLI auto-pobierania wyników (warstwa IO). Pipeline:
//   tury (data/k1/tura-*.json) + dotychczasowe wyniki (results.json) + mecze z API
//   → mergeScores → dopisz TYLKO brakujące mecze FINISHED → zapisz results.json.
// Istniejące wpisy są nietykalne (ręczna nadpiska wygrywa). Token z env FOOTBALL_DATA_TOKEN.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { fetchWorldCupMatches } from './footballData';
import { mergeScores, type TurnFixtures, type Results } from './matchScores';

const DATA_DIR = 'data/k1';
const RESULTS = `${DATA_DIR}/results.json`;

async function main() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    console.error('Brak FOOTBALL_DATA_TOKEN w środowisku. Ustaw zmienną (lokalnie / GitHub Secret).');
    process.exit(1);
  }

  // Wszystkie tury: data/k1/tura-1.json, tura-2.json, ...
  const turns: TurnFixtures[] = readdirSync(DATA_DIR)
    .filter((f) => /^tura-\d+\.json$/.test(f))
    .map((f) => {
      const t = JSON.parse(readFileSync(`${DATA_DIR}/${f}`, 'utf8'));
      return { turn: t.turn, fixtures: t.fixtures } as TurnFixtures;
    })
    .sort((a, b) => a.turn - b.turn);

  if (turns.length === 0) {
    console.error(`Brak plików tura-*.json w ${DATA_DIR}.`);
    process.exit(1);
  }

  const existing: Results = existsSync(RESULTS)
    ? JSON.parse(readFileSync(RESULTS, 'utf8'))
    : {};

  const apiMatches = await fetchWorldCupMatches(token);
  const { results, added } = mergeScores(turns, existing, apiMatches);

  if (added.length === 0) {
    console.log('Brak nowych rozegranych meczów — results.json bez zmian.');
    return;
  }

  writeFileSync(RESULTS, JSON.stringify(results, null, 2) + '\n');
  console.log(`Dopisano ${added.length} wynik(ów) do ${RESULTS}:`);
  for (const a of added) console.log(`  • tura ${a.turn}, mecz ${a.no}: ${a.label}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
