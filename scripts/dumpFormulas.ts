// Jednorazowe narzędzie: zrzut formuł + wartości prostokąta arkusza.
// Użycie: tsx scripts/dumpFormulas.ts "plik.xlsx" "arkusz" C 4 F 60
import { readFileSync } from 'fs';
import { unzip } from '../ingest/xlsx/zip';

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

const [path, sheetName, colFrom, rowFromS, colTo, rowToS] = process.argv.slice(2);
const entries = unzip(readFileSync(path));
const dec = (name: string) => entries.get(name)?.toString('utf8') ?? '';

const rid2target = new Map<string, string>();
for (const rel of dec('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
  const id = rel[0].match(/\bId="([^"]+)"/)?.[1];
  const target = rel[0].match(/\bTarget="([^"]+)"/)?.[1];
  if (id && target) rid2target.set(id, target);
}
let sheetPath = '';
for (const sh of dec('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
  const name = decodeXml(sh[0].match(/\bname="([^"]+)"/)?.[1] ?? '');
  const rid = sh[0].match(/\br:id="([^"]+)"/)?.[1] ?? '';
  if (name === sheetName) {
    let t = (rid2target.get(rid) ?? '').replace(/^\//, '');
    sheetPath = t.startsWith('xl/') ? t : 'xl/' + t;
  }
}
if (!sheetPath) throw new Error(`Brak arkusza: ${sheetName}`);

const colNum = (c: string) => [...c].reduce((a, ch) => a * 26 + ch.charCodeAt(0) - 64, 0);
const c1 = colNum(colFrom);
const c2 = colNum(colTo);
const r1 = parseInt(rowFromS, 10);
const r2 = parseInt(rowToS, 10);

const xml = dec(sheetPath);
const cellRe = /<c\s+r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
const rows = new Map<number, string[]>();
for (const m of xml.matchAll(cellRe)) {
  const col = colNum(m[1]);
  const row = parseInt(m[2], 10);
  if (col < c1 || col > c2 || row < r1 || row > r2 || m[4] === undefined) continue;
  const f = m[4].match(/<f\b[^>]*>([\s\S]*?)<\/f>/)?.[1];
  const v = m[4].match(/<v>([\s\S]*?)<\/v>/)?.[1];
  const desc = `${m[1]}${row}=${f !== undefined ? '=' + decodeXml(f) : ''}${f !== undefined && v !== undefined ? ' →' : ''}${v !== undefined ? decodeXml(v) : ''}`;
  if (!rows.has(row)) rows.set(row, []);
  rows.get(row)!.push(desc);
}
for (const row of [...rows.keys()].sort((a, b) => a - b)) console.log(rows.get(row)!.join('  '));
