// Golden test Etapu B: robot pucharowy musi ODTWORZYĆ z żywego API wszystkie wyniki
// pucharowe wpisane dotąd ręcznie w data/k1/results.json["puch"] (w tym karne: pk).
// NIE dotyka żadnych plików — liczy merge od zera (existing={}) i porównuje.
// Exit 0 = 1:1 zgodne; exit 1 = rozbieżność (STOP: quirk API albo błąd ręcznego wpisu).
// Uruchomienie: FOOTBALL_DATA_TOKEN w env (lokalnie albo workflow spike-puchar.yml).
import { readFileSync } from 'node:fs';
import { fetchWorldCupMatches } from '../ingest/scores/footballData';
import {
  mergePucharScores,
  type PucharRoundFixtures,
  type PucharScore,
} from '../ingest/scores/matchPucharScores';

async function main() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) {
    console.error('Brak FOOTBALL_DATA_TOKEN w środowisku.');
    process.exit(1);
  }

  const puchar = JSON.parse(readFileSync('data/k1/puchar.json', 'utf8')) as {
    rounds: PucharRoundFixtures[];
  };
  const manual = (
    JSON.parse(readFileSync('data/k1/results.json', 'utf8')) as {
      puch?: Record<string, PucharScore>;
    }
  ).puch ?? {};

  const apiMatches = await fetchWorldCupMatches(token);
  const { puch, warnings } = mergePucharScores(puchar.rounds, {}, apiMatches);
  for (const w of warnings) console.warn(`UWAGA: ${w}`);

  const keys = [...new Set([...Object.keys(manual), ...Object.keys(puch)])].sort(
    (a, b) => Number(a) - Number(b),
  );
  let diffs = 0;
  for (const no of keys) {
    const m = manual[no] ? JSON.stringify(manual[no]) : '(brak)';
    const r = puch[no] ? JSON.stringify(puch[no]) : '(brak)';
    if (m !== r) {
      diffs++;
      console.error(`✗ mecz ${no}: ręcznie ${m} vs robot ${r}`);
    } else {
      console.log(`✓ mecz ${no}: ${m}`);
    }
  }

  if (diffs > 0) {
    console.error(`\nGOLDEN NIEZGODNY: ${diffs} rozbieżność(i) na ${keys.length} meczów.`);
    process.exit(1);
  }
  console.log(`\nGOLDEN OK: ${keys.length}/${keys.length} wpisów pucharowych zgodnych 1:1.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
