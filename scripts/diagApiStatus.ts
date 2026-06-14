// DIAGNOSTYKA (read-only): co football-data.org mówi DZIŚ o naszych meczach?
// Nic nie zapisuje. Dla każdego fixture'a pokazuje: czy API ma parę, status, datę UTC, wynik.
// Na końcu listuje mecze API ze statusem FINISHED, których NIE dopasowaliśmy.
import { readFileSync, readdirSync } from 'node:fs';
import { fetchWorldCupMatches } from '../ingest/scores/footballData';
import { toApiName } from '../ingest/scores/teamMap';
import type { ApiMatch } from '../ingest/scores/matchScores';

const pairKey = (a: string, b: string) => [a, b].sort().join(' :: ');

async function main() {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error('Brak FOOTBALL_DATA_TOKEN');

  const api = await fetchWorldCupMatches(token);
  console.log(`API zwróciło ${api.length} meczów MŚ.`);
  const byPair = new Map<string, ApiMatch>();
  for (const m of api) byPair.set(pairKey(m.home, m.away), m);

  const matchedPairs = new Set<string>();
  const turns = readdirSync('data/k1')
    .filter((f) => /^tura-\d+\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(`data/k1/${f}`, 'utf8')));

  for (const t of turns) {
    for (const fx of t.fixtures) {
      const key = pairKey(toApiName(fx.home), toApiName(fx.away));
      const m = byPair.get(key);
      matchedPairs.add(key);
      const label = `tura${t.turn} mecz${String(fx.no).padStart(2)} ${fx.home} vs ${fx.away}`;
      if (!m) {
        console.log(`❌ ${label} — BRAK pary w API (sprawdź teamMap / harmonogram)`);
      } else {
        const score =
          m.homeGoals != null ? `${m.homeGoals}:${m.awayGoals}` : '—';
        console.log(`   ${label} — status=${m.status} date=${m.utcDate ?? '?'} wynik=${score}`);
      }
    }
  }

  console.log('\n=== Mecze API FINISHED, których NIE mamy w fixture’ach ===');
  let extra = 0;
  for (const m of api) {
    if (m.status !== 'FINISHED') continue;
    if (matchedPairs.has(pairKey(m.home, m.away))) continue;
    extra++;
    console.log(`   ${m.home} ${m.homeGoals}:${m.awayGoals} ${m.away} (${m.utcDate ?? '?'})`);
  }
  if (extra === 0) console.log('   (żadnych)');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
