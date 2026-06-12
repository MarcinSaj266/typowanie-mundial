// Jednorazowe narzędzie: zrzut prostokąta komórek arkusza.
// Użycie: tsx scripts/dumpRegion.ts "plik.xlsx" "arkusz" A 60 N 130
import { readFileSync } from 'fs';
import { openXlsx } from '../ingest/xlsx/workbook';

const [path, sheetName, colFrom, rowFromS, colTo, rowToS] = process.argv.slice(2);
const wb = openXlsx(readFileSync(path));
const sheet = wb.sheet(sheetName);

const colNum = (c: string) => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const colName = (n: number) => {
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(((n - 1) % 26) + 65) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
};

const c1 = colNum(colFrom);
const c2 = colNum(colTo);
for (let r = parseInt(rowFromS, 10); r <= parseInt(rowToS, 10); r++) {
  const parts: string[] = [];
  for (let c = c1; c <= c2; c++) {
    const v = sheet.cell(`${colName(c)}${r}`);
    if (v !== undefined) parts.push(`${colName(c)}${r}=${JSON.stringify(v)}`);
  }
  if (parts.length > 0) console.log(parts.join('  '));
}
