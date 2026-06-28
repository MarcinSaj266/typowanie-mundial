import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { buildResults } from './buildResults';
import type { PucharData, PucharResult } from './types';

const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const DATA_DIR = 'data/k1';
const OUT_DIR = 'public/data';

const turns = readdirSync(DATA_DIR)
  .filter((f) => /^tura-\d+\.json$/.test(f))
  .map((f) => read(`${DATA_DIR}/${f}`))
  .sort((a, b) => a.turn - b.turn);

// Wyniki: rozdzielamy turę grupową (Record<turn,Record<no,Score>>) od pucharu (klucz "puch").
const resultsJson = read(`${DATA_DIR}/results.json`);
const { puch: puchResults = {}, ...turnResults } = resultsJson as { puch?: Record<string, PucharResult> };

// Puchar (opcjonalny — może jeszcze nie istnieć).
const puchar: PucharData = existsSync(`${DATA_DIR}/puchar.json`)
  ? read(`${DATA_DIR}/puchar.json`)
  : { rounds: [] };

const out = buildResults(read(`${DATA_DIR}/roster.json`), turns, turnResults, puchar, puchResults);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, JSON.stringify(out, null, 2) + '\n');

const lider = out.general[0];
const puchN = out.puchar.rounds.reduce((a, r) => a + r.matches.length, 0);
console.log(
  `OK: ${out.general.length} osob, lider ${lider.participantId} (${lider.points} pkt), ${puchN} meczów puch → ${OUT_DIR}/results.json`,
);
