import { writeFileSync } from 'node:fs';
import { seedTurnResults } from './seed';

// Stałe ziarno = powtarzalne atrapy. Plik podmienia się później na realne wyniki.
const SEED = 20260611;
const OUT = 'data/k1/results.json';

const results = { '1': seedTurnResults(24, SEED) };
writeFileSync(OUT, JSON.stringify(results, null, 2) + '\n');
console.log(`OK: atrapy wynikow tury 1 (24 mecze) → ${OUT}`);
