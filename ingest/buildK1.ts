import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { openXlsx } from './xlsx/workbook';
import { parseGrup1 } from './k1/parseGrup1';

const MASTER = 'konkurs 2026.06.12 - poprawiony.xlsx';
const OUT_DIR = 'data/k1';

const parsed = parseGrup1(openXlsx(readFileSync(MASTER)).sheet('grup-1'));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/roster.json`, JSON.stringify(parsed.participants, null, 2) + '\n');
writeFileSync(
  `${OUT_DIR}/tura-1.json`,
  JSON.stringify({ turn: 1, fixtures: parsed.fixtures, predictions: parsed.predictions }, null, 2) + '\n',
);

console.log(
  `OK: ${parsed.participants.length} uczestnikow, ${parsed.fixtures.length} meczow → ${OUT_DIR}/`,
);
