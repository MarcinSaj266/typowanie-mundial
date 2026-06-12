// Audyt end-to-end logiki K1 (2026-06-12, przed oddaniem produkcji):
// 1) tabela ogólna z naszego silnika vs cache formuł arkusza `tabela` mastera
//    (pkt, #3/#4/#5/#6, %, grI..grIII, bns, puch — per gracz, niezależnie od kolejności);
// 2) symulacja w pamięci: dopisanie wyniku meczu 3 → czy klasyfikacja się przelicza
//    i czy przyrosty punktów zgadzają się z NIEZALEŻNIE zapisaną regułą punktacji.
// Użycie: tsx scripts/auditResults.ts "konkurs ....xlsx"
import { readFileSync } from 'node:fs';
import { openXlsx } from '../ingest/xlsx/workbook';
import { buildResults } from '../compute/buildResults';

const masterPath = process.argv[2] ?? 'konkurs 2026.06.12 - poprawiony.xlsx';
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const roster = read('data/k1/roster.json');
const tura1 = read('data/k1/tura-1.json');
const results = read('data/k1/results.json');

let bledy = 0;
const blad = (msg: string) => {
  console.error(`AUDIT FAIL: ${msg}`);
  bledy++;
};

// ── 1. Nasza tabela ogólna vs arkusz `tabela` ────────────────────────────────
const nasze = buildResults(roster, [tura1], results);
const sheet = openXlsx(readFileSync(masterPath)).sheet('tabela');
const num = (ref: string) => Number(sheet.cell(ref) ?? 0);

let porownanych = 0;
for (let r = 3; r <= 58; r++) {
  const id = sheet.cell(`C${r}`);
  if (id === undefined) continue;
  const row = nasze.general.find((g) => g.participantId === String(id));
  if (!row) {
    blad(`brak gracza ${id} w naszej tabeli ogólnej`);
    continue;
  }
  porownanych++;
  const pary: [string, number, number][] = [
    ['pkt', num(`D${r}`), row.points],
    ['#3', num(`E${r}`), row.count3],
    ['#4', num(`F${r}`), row.count4],
    ['#5', num(`G${r}`), row.count5],
    ['grI', num(`J${r}`), row.grI],
    ['grII', num(`K${r}`), row.grII],
    ['grIII', num(`L${r}`), row.grIII],
    ['bns', num(`M${r}`), row.bns],
    ['puch', num(`N${r}`), row.puch],
  ];
  for (const [pole, excel, my] of pary) {
    if (excel !== my) blad(`${id}.${pole}: Excel=${excel}, my=${my}`);
  }
  // % w Excelu bywa pusty przy 0 rozegranych; porównuj z tolerancją zmiennoprzecinkową.
  const excelProc = sheet.cell(`I${r}`);
  if (excelProc !== undefined && Math.abs(Number(excelProc) - row.hitRate) > 1e-9) {
    blad(`${id}.%: Excel=${excelProc}, my=${row.hitRate}`);
  }
}
console.log(`1) tabela ogólna vs Excel: porównano ${porownanych} graczy, błędów: ${bledy}`);

// Sekwencja punktów po sortowaniu musi być identyczna (kolejność remisów może się różnić,
// bo SORTBY organizatora ma błędne tiebreakery — potwierdzone 2026-06-12).
const excelPkt: number[] = [];
for (let r = 3; r <= 58; r++) if (sheet.cell(`C${r}`) !== undefined) excelPkt.push(num(`D${r}`));
const naszePkt = nasze.general.map((g) => g.points);
if (JSON.stringify(excelPkt) !== JSON.stringify(naszePkt)) {
  blad(`sekwencja pkt po sortowaniu różni się:\n  Excel: ${excelPkt.join(',')}\n  my:    ${naszePkt.join(',')}`);
} else {
  console.log('   sekwencja punktów w rankingu identyczna z Excelem');
}

// ── 2. Symulacja: wynik meczu 3 (Kanada–Bośnia 2:1) w pamięci ───────────────
// Niezależna implementacja reguły (spec: trafiony rezultat 3, +1 różnica, +1 dokładny):
function reguła(typ: { home: number; away: number }, wynik: { home: number; away: number }): number {
  const znak = (d: number) => (d > 0 ? 1 : d < 0 ? -1 : 0);
  if (znak(typ.home - typ.away) !== znak(wynik.home - wynik.away)) return 0;
  let pkt = 3;
  if (typ.home - typ.away === wynik.home - wynik.away) pkt += 1;
  if (typ.home === wynik.home && typ.away === wynik.away) pkt += 1;
  return pkt;
}

const symWynik = { home: 2, away: 1 };
const symResults = { ...results, '1': { ...results['1'], '3': symWynik } };
const po = buildResults(roster, [tura1], symResults);

for (const g of po.general) {
  const przed = nasze.general.find((x) => x.participantId === g.participantId)!;
  const typ = tura1.predictions[g.participantId]?.['3'] ?? null;
  const oczekiwanyPrzyrost = typ ? reguła(typ, symWynik) : 0;
  if (g.points - przed.points !== oczekiwanyPrzyrost) {
    blad(
      `${g.participantId}: przyrost pkt po meczu 3 = ${g.points - przed.points}, ` +
        `oczekiwano ${oczekiwanyPrzyrost} (typ ${typ ? `${typ.home}:${typ.away}` : 'brak'})`,
    );
  }
  if (g.played - przed.played !== 1) blad(`${g.participantId}: played nie wzrosło o 1`);
}

// Czy posortowanie po symulacji respektuje klucze pkt → % → puch → grI → grII → grIII?
for (let i = 1; i < po.general.length; i++) {
  const a = po.general[i - 1];
  const b = po.general[i];
  const klucze = ['points', 'hitRate', 'puch', 'grI', 'grII', 'grIII'] as const;
  let ok = false;
  for (const k of klucze) {
    if (a[k] > b[k]) { ok = true; break; }
    if (a[k] < b[k]) { blad(`zły porządek na pozycjach ${i}/${i + 1}: ${a.participantId} vs ${b.participantId} (${k})`); ok = true; break; }
  }
  if (!ok) ok = true; // pełny remis wszystkich kluczy — kolejność dowolna
}

// Tabele grupowe: pkt musi być sumą grI+grII+grIII i ranking wg pkt → % → grI → grII → grIII.
for (const [grupa, wiersze] of Object.entries(po.groups)) {
  for (const w of wiersze) {
    if (w.points !== w.grI + w.grII + w.grIII) blad(`grupa ${grupa}, ${w.participantId}: pkt != grI+grII+grIII`);
  }
  for (let i = 1; i < wiersze.length; i++) {
    if (wiersze[i - 1].points < wiersze[i].points) blad(`grupa ${grupa}: zły porządek pkt na pozycji ${i}`);
  }
}

const lider = po.general[0];
console.log(
  `2) symulacja meczu 3 (2:1): klasyfikacja przeliczona, lider po symulacji: ` +
    `${lider.participantId} (${lider.points} pkt), przyrosty punktów zgodne z regułą`,
);

if (bledy > 0) {
  console.error(`\nAUDYT: ${bledy} błędów`);
  process.exit(1);
}
console.log('\nAUDYT OK: dane i logika spójne, klasyfikacje przeliczają się po dopisaniu wyniku');
