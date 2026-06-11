import { unzip } from './zip';

export interface Sheet {
  /** Wartość komórki (string z sharedStrings / liczba) lub undefined, gdy pusta. */
  cell(ref: string): string | number | undefined;
  /** Najwyższy numer wiersza z jakąkolwiek wartością. */
  maxRow: number;
}

export interface Workbook {
  sheetNames: string[];
  sheet(name: string): Sheet;
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

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    let text = '';
    for (const t of si[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
    out.push(decodeXml(text));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): Sheet {
  const cells = new Map<string, string | number>();
  let maxRow = 0;
  const cellRe = /<c\s+r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (const m of xml.matchAll(cellRe)) {
    const inner = m[4];
    if (inner === undefined) continue; // pusta komórka (self-closing)
    const col = m[1];
    const row = parseInt(m[2], 10);
    const type = m[3].match(/\bt="([^"]+)"/)?.[1] ?? 'n';
    let value: string | number | undefined;
    if (type === 's') {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (v) value = shared[parseInt(v[1], 10)];
    } else if (type === 'inlineStr') {
      let text = '';
      for (const t of inner.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)) text += t[1];
      value = decodeXml(text);
    } else if (type === 'str') {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (v) value = decodeXml(v[1]);
    } else {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (v) value = Number(v[1]);
    }
    if (value === undefined) continue;
    cells.set(`${col}${row}`, value);
    if (row > maxRow) maxRow = row;
  }
  return { cell: (ref) => cells.get(ref), maxRow };
}

export function openXlsx(buf: Buffer): Workbook {
  const entries = unzip(buf);
  const dec = (name: string) => entries.get(name)?.toString('utf8') ?? '';

  const shared = entries.has('xl/sharedStrings.xml')
    ? parseSharedStrings(dec('xl/sharedStrings.xml'))
    : [];

  const rid2target = new Map<string, string>();
  for (const rel of dec('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = rel[0].match(/\bId="([^"]+)"/)?.[1];
    const target = rel[0].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) rid2target.set(id, target);
  }

  const sheetNames: string[] = [];
  const name2path = new Map<string, string>();
  for (const sh of dec('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)) {
    const name = sh[0].match(/\bname="([^"]+)"/)?.[1];
    const rid = sh[0].match(/\br:id="([^"]+)"/)?.[1];
    if (!name || !rid) continue;
    const decoded = decodeXml(name);
    sheetNames.push(decoded);
    let target = (rid2target.get(rid) ?? '').replace(/^\//, '');
    if (!target.startsWith('xl/')) target = 'xl/' + target;
    name2path.set(decoded, target);
  }

  const cache = new Map<string, Sheet>();
  return {
    sheetNames,
    sheet(name: string): Sheet {
      const cached = cache.get(name);
      if (cached) return cached;
      const path = name2path.get(name);
      if (!path) throw new Error(`Brak arkusza: ${name}`);
      const s = parseSheet(dec(path), shared);
      cache.set(name, s);
      return s;
    },
  };
}
