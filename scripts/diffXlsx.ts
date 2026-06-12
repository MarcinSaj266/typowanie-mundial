// Jednorazowe narzędzie: diff dwóch plików xlsx per komórka (wartości + formuły).
// Użycie: tsx scripts/diffXlsx.ts "stary.xlsx" "nowy.xlsx"
import { readFileSync } from 'fs';
import { unzip } from '../ingest/xlsx/zip';

interface Cell {
  v?: string;
  f?: string;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&');
}

function parseShared(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    let text = '';
    for (const t of si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
    out.push(decodeXml(text));
  }
  return out;
}

function parseCells(xml: string, shared: string[]): Map<string, Cell> {
  const cells = new Map<string, Cell>();
  const cellRe = /<c\s+r="([A-Z]+\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (const m of xml.matchAll(cellRe)) {
    const inner = m[3];
    if (inner === undefined) continue;
    const type = m[2].match(/\bt="([^"]+)"/)?.[1] ?? 'n';
    const cell: Cell = {};
    const f = inner.match(/<f\b[^>]*>([\s\S]*?)<\/f>/);
    if (f) cell.f = decodeXml(f[1]);
    const v = inner.match(/<v>([\s\S]*?)<\/v>/);
    if (v) cell.v = type === 's' ? shared[parseInt(v[1], 10)] : decodeXml(v[1]);
    if (cell.f === undefined && cell.v === undefined) continue;
    cells.set(m[1], cell);
  }
  return cells;
}

function openSheets(path: string): Map<string, Map<string, Cell>> {
  const entries = unzip(readFileSync(path));
  const dec = (name: string) => entries.get(name)?.toString('utf8') ?? '';
  const shared = entries.has('xl/sharedStrings.xml') ? parseShared(dec('xl/sharedStrings.xml')) : [];

  const rid2target = new Map<string, string>();
  for (const rel of dec('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = rel[0].match(/\bId="([^"]+)"/)?.[1];
    const target = rel[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) rid2target.set(id, target);
  }

  const out = new Map<string, Map<string, Cell>>();
  for (const sh of dec('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = sh[0].match(/\bname="([^"]+)"/)?.[1];
    const rid = sh[0].match(/\br:id="([^"]+)"/)?.[1];
    if (!name || !rid) continue;
    let target = (rid2target.get(rid) ?? '').replace(/^\//, '');
    if (!target.startsWith('xl/')) target = 'xl/' + target;
    out.set(decodeXml(name), parseCells(dec(target), shared));
  }
  return out;
}

const [oldPath, newPath, mode] = process.argv.slice(2);
const onlyFormulas = mode === '--only-formulas';
const oldWb = openSheets(oldPath);
const newWb = openSheets(newPath);

const fmt = (c?: Cell) =>
  c === undefined ? '∅' : `${c.f !== undefined ? '=' + c.f : ''}${c.f !== undefined && c.v !== undefined ? ' → ' : ''}${c.v ?? ''}`;

for (const name of new Set([...oldWb.keys(), ...newWb.keys()])) {
  const o = oldWb.get(name) ?? new Map<string, Cell>();
  const n = newWb.get(name) ?? new Map<string, Cell>();
  const refs = [...new Set([...o.keys(), ...n.keys()])];
  const diffs: string[] = [];
  for (const ref of refs) {
    const oc = o.get(ref);
    const nc = n.get(ref);
    if (onlyFormulas) {
      if (oc?.f === nc?.f) continue;
    } else if (oc?.f === nc?.f && oc?.v === nc?.v) continue;
    diffs.push(`  ${ref}: ${fmt(oc)}  =>  ${fmt(nc)}`);
  }
  if (diffs.length === 0) continue;
  console.log(`\n### ${name} — ${diffs.length} zmian`);
  const limit = process.env.DIFF_LIMIT ? parseInt(process.env.DIFF_LIMIT, 10) : 80;
  for (const d of diffs.slice(0, limit)) console.log(d);
  if (diffs.length > limit) console.log(`  ... (+${diffs.length - limit} dalszych)`);
}
