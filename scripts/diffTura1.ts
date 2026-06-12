// Jednorazowe narzędzie: porównanie typów tury 1 (stary vs nowy ingest)
// oraz krzyżowa walidacja nowego ingestu z plikiem "Baza tura 1.xlsx" organizatora.
import { readFileSync } from 'node:fs';
import { openXlsx } from '../ingest/xlsx/workbook';

type Pred = { home: number; away: number };
type Tura = {
  turn: number;
  fixtures: { no: number; home: string; away: string }[];
  predictions: Record<string, Record<string, Pred>>;
};

const oldT: Tura = JSON.parse(readFileSync('data/k1/tura-1.OLD.json', 'utf8'));
const newT: Tura = JSON.parse(readFileSync('data/k1/tura-1.json', 'utf8'));

// --- 1. Diff stary vs nowy ingest ---
console.log('=== DIFF stary master -> poprawiony master ===');
let diffs = 0;
for (const player of Object.keys(newT.predictions)) {
  const o = oldT.predictions[player];
  const n = newT.predictions[player];
  if (!o) {
    console.log(`NOWY GRACZ: ${player}`);
    diffs++;
    continue;
  }
  for (const m of Object.keys(n)) {
    const op = o[m];
    const np = n[m];
    if (!op || op.home !== np.home || op.away !== np.away) {
      const fx = newT.fixtures.find((f) => f.no === Number(m));
      console.log(
        `${player} mecz ${m} (${fx?.home}-${fx?.away}): ` +
          `${op ? `${op.home}:${op.away}` : '∅'} => ${np.home}:${np.away}`,
      );
      diffs++;
    }
  }
}
console.log(`Rozbieżności: ${diffs}`);

// --- 2. Walidacja nowego ingestu vs "Baza tura 1.xlsx" ---
console.log('\n=== WALIDACJA nowy ingest vs Baza tura 1.xlsx ===');
const wb = openXlsx(readFileSync('Baza tura 1.xlsx'));
const sheet = wb.sheet(wb.sheetNames[0]);
// Nicki w bazie różnią się pisownią od mastera `grup-1` (źródła prawdy) — mapa aliasów:
const ALIAS: Record<string, string> = {
  WojtekN: 'Wojtek',
  'Turbo-Ryzu': 'Turbo-Ryżu',
  RafałCz: 'Rafał',
  'Sławek G.': 'Sławek',
  PawełS: 'PawełSt',
};
let rows = 0;
let mismatches = 0;
const seen = new Set<string>();
for (let r = 2; r <= sheet.maxRow; r++) {
  const raw = sheet.cell(`C${r}`);
  if (raw === undefined) continue;
  const player = ALIAS[String(raw)] ?? String(raw);
  const match = Number(sheet.cell(`D${r}`));
  const w1 = sheet.cell(`G${r}`);
  const w2 = sheet.cell(`H${r}`);
  rows++;
  seen.add(`${player}|${match}`);
  const p = newT.predictions[String(player)]?.[String(match)];
  if (!p) {
    console.log(`BRAK w ingest: ${player} mecz ${match}`);
    mismatches++;
    continue;
  }
  if (p.home !== Number(w1) || p.away !== Number(w2)) {
    console.log(`ROZJAZD: ${player} mecz ${match}: baza ${w1}:${w2}, ingest ${p.home}:${p.away}`);
    mismatches++;
  }
}
// czy ingest ma coś, czego nie ma w bazie?
let extra = 0;
for (const [player, preds] of Object.entries(newT.predictions)) {
  for (const m of Object.keys(preds)) {
    if (!seen.has(`${player}|${m}`)) {
      console.log(`NADMIAR w ingest (brak w bazie): ${player} mecz ${m}`);
      extra++;
    }
  }
}
console.log(`Wierszy bazy: ${rows}, rozjazdów: ${mismatches}, nadmiarowych: ${extra}`);
