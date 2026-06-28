// CLI ingestu typów pucharowych (Konkurs 1). Źródło: płaska baza organizatora
// "Baza puch vN.xlsx" (arkusz 't2'). Pipeline:
//   Baza puch v1.xlsx + roster.json → parseBazaPuchar → data/k1/puchar.json (runda 1/16)
// Tolerancyjny: typy spływają etapami (v1 niepełny — 3 osoby + KasiaK bez typów). Reingest
// nowszej bazy nadpisuje plik. Terminy 1/16 na razie puste (doda robot/Etap B w czasie PL).
import { readFileSync, writeFileSync } from 'node:fs';
import { openXlsx } from './xlsx/workbook';
import { parseBazaPuchar, type PucharRound } from './k1/parseBazaPuchar';
import type { Participant } from './k1/parseGrup1';

const BAZA = 'Baza puch v1.xlsx';
const SHEET = 't2';
const ROSTER = 'data/k1/roster.json';
const OUT = 'data/k1/puchar.json';
const EXPECTED_FIXTURES = 16; // 1/16 finału (the last 32)

// Pisownia nicka w bazie → kanoniczny nick z rosteru (te same aliasy co tury 1–3).
const NICK_ALIAS: Record<string, string> = {
  WojtekN: 'Wojtek',
  'Turbo-Ryzu': 'Turbo-Ryżu',
  RafałCz: 'Rafał',
  'Sławek G.': 'Sławek',
  PawełS: 'PawełSt',
};

const roster: Participant[] = JSON.parse(readFileSync(ROSTER, 'utf8'));
const sheet = openXlsx(readFileSync(BAZA)).sheet(SHEET);
const round: PucharRound = parseBazaPuchar(sheet, { round: '1/16', roster, nickAlias: NICK_ALIAS });

if (round.fixtures.length !== EXPECTED_FIXTURES) {
  throw new Error(`Oczekiwano ${EXPECTED_FIXTURES} meczów 1/16, jest ${round.fixtures.length}`);
}

writeFileSync(OUT, JSON.stringify({ rounds: [round] }, null, 2) + '\n');

const withTyp = Object.keys(round.predictions).length;
const noTyp = roster.filter((p) => !round.predictions[p.id]).map((p) => p.id);
let krzyzyki = 0;
for (const byMatch of Object.values(round.predictions))
  for (const pick of Object.values(byMatch)) if (pick.pk) krzyzyki++;
console.log(`OK: ${round.fixtures.length} meczów 1/16, ${withTyp}/${roster.length} graczy z typami, ${krzyzyki} krzyżyków → ${OUT}`);
console.log(`Bez ŻADNEGO typu (0 pkt): ${noTyp.length ? noTyp.join(', ') : '—'}`);
