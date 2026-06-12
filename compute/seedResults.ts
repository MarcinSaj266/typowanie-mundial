import { existsSync, writeFileSync } from 'node:fs';
import { seedTurnResults } from './seed';

// Stałe ziarno = powtarzalne atrapy. Plik podmienia się później na realne wyniki.
const SEED = 20260611;
const OUT = 'data/k1/results.json';

// W pliku siedzą już realne, ręcznie wpisywane wyniki — atrap nie wolno nimi nadpisać.
if (existsSync(OUT)) {
  console.error(`STOP: ${OUT} juz istnieje (realne wyniki?) — usun plik recznie, jesli na pewno chcesz atrapy.`);
  process.exit(1);
}

const results = { '1': seedTurnResults(24, SEED) };
writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
console.log(`OK: atrapy wynikow tury 1 (24 mecze) → ${OUT}`);
