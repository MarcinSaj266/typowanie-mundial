import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { buildResults } from './buildResults';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const DATA_DIR = 'data/k1';
const OUT_DIR = 'public/data';

// Wszystkie tury: data/k1/tura-1.json, tura-2.json, ... (rosnąco po numerze).
const turns = readdirSync(DATA_DIR)
  .filter((f) => /^tura-\d+\.json$/.test(f))
  .map((f) => read(`${DATA_DIR}/${f}`))
  .sort((a, b) => a.turn - b.turn);

const out = buildResults(
  read(`${DATA_DIR}/roster.json`),
  turns,
  read(`${DATA_DIR}/results.json`),
);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(out, null, 2) + '\n');

const lider = out.general[0];
console.log(
  `OK: ${out.general.length} osob, lider ${lider.participantId} (${lider.points} pkt) → ${OUT_DIR}/results.json`,
);
