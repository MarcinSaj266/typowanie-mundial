// Jednorazowa walidacja: punkty per gracz/mecz z naszego silnika vs cache formuł Excela (grup-1, kolumny H/N).
// Użycie: tsx scripts/validateVsExcel.ts "konkurs 2026.06.12.xlsx"
import { readFileSync } from 'fs';
import { openXlsx } from '../ingest/xlsx/workbook';

const masterPath = process.argv[2];
const wb = openXlsx(readFileSync(masterPath));
const sheet = wb.sheet('grup-1');
const results = JSON.parse(readFileSync('public/data/results.json', 'utf8'));

const HEADER_ROW_1 = 4; // mecz 1; kolejne co 31 wierszy
const STRIDE = 31;

let checked = 0;
let mismatches = 0;
for (const turn of results.turns) {
  // Arkusz grup-1 mastera zawiera WYŁĄCZNIE turę 1 — pozostałe tury walidujemy osobno.
  if (turn.turn !== 1) continue;
  for (const match of turn.matches) {
    const headerRow = HEADER_ROW_1 + (match.no - 1) * STRIDE;
    const played = sheet.cell(`G${headerRow}`) !== undefined;
    if (!played) continue;
    for (let i = 0; i < 28; i++) {
      const row = headerRow + 2 + i;
      for (const [nameCol, ptsCol] of [
        ['E', 'H'],
        ['K', 'N'],
      ] as const) {
        const name = sheet.cell(`${nameCol}${row}`);
        if (typeof name !== 'string') continue;
        const excelPts = sheet.cell(`${ptsCol}${row}`);
        const ourPts = match.predictions[name]?.points;
        checked++;
        if (excelPts !== ourPts) {
          mismatches++;
          console.log(
            `ROZBIEŻNOŚĆ mecz ${match.no} (${match.home}–${match.away}) ${name}: Excel=${excelPts} silnik=${ourPts}`,
          );
        }
      }
    }
  }
}
console.log(`\nSprawdzono ${checked} par (gracz × rozegrany mecz), rozbieżności: ${mismatches}`);
if (mismatches > 0) process.exitCode = 1;
