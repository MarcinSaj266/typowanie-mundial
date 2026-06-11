import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildResults } from './buildResults';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const OUT_DIR = 'public/data';

const out = buildResults(
  read('data/k1/roster.json'),
  [read('data/k1/tura-1.json')],
  read('data/k1/results.json'),
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(out, null, 2) + '\n');

const lider = out.general[0];
console.log(
  `OK: ${out.general.length} osob, lider ${lider.participantId} (${lider.points} pkt) → ${OUT_DIR}/results.json`,
);
