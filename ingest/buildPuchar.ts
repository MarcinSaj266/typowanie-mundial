// CLI ingestu typów pucharowych (Konkurs 1). Źródło: płaska baza organizatora
// "Baza puch vN.xlsx" (arkusz 't2'). Pipeline:
//   Baza puch v1.xlsx + roster.json → parseBazaPuchar → data/k1/puchar.json (runda 1/16)
// Tolerancyjny: typy spływają etapami (v1 niepełny — 3 osoby + KasiaK bez typów). Reingest
// nowszej bazy nadpisuje plik. Terminy 1/16 na razie puste (doda robot/Etap B w czasie PL).
import { readFileSync, writeFileSync } from 'node:fs';
import { openXlsx } from './xlsx/workbook';
import { parseBazaPuchar, type PucharRound } from './k1/parseBazaPuchar';
import type { Participant } from './k1/parseGrup1';

const BAZA = 'Baza puch v2.xlsx';
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

// Terminarz 1/16 MŚ 2026 (źródło: ESPN / worldcupwiki, R32 28 cze – 3 lip), godziny ET.
// W bazie terminów nie ma — jak w turach grupowych bierzemy z oficjalnego terminarza i
// przeliczamy ET (EDT = UTC−4) → POLSKI (CEST = UTC+2), czyli ET + 6h. Numer naszego meczu →
// {miesiąc, dzień, godzina ET, minuta ET}. Część meczów ma połówki godziny (16:30, 21:30).
const ET_SCHEDULE: Record<number, { m: number; day: number; h: number; min: number }> = {
  1: { m: 6, day: 28, h: 15, min: 0 }, // Kanada-RPA (nd 28 cze 15:00 ET)
  2: { m: 6, day: 29, h: 13, min: 0 }, // Brazylia-Japonia
  3: { m: 6, day: 29, h: 16, min: 30 }, // Niemcy-Paragwaj
  4: { m: 6, day: 29, h: 21, min: 0 }, // Holandia-Maroko
  5: { m: 6, day: 30, h: 13, min: 0 }, // Wybrzeże Kość. Słon.-Norwegia
  6: { m: 6, day: 30, h: 17, min: 0 }, // Francja-Szwecja
  7: { m: 6, day: 30, h: 21, min: 0 }, // Meksyk-Ekwador
  8: { m: 7, day: 1, h: 12, min: 0 }, // Anglia-DR Konga
  9: { m: 7, day: 1, h: 16, min: 0 }, // Belgia-Senegal
  10: { m: 7, day: 1, h: 20, min: 0 }, // USA-Bośnia i Hercegowina
  11: { m: 7, day: 2, h: 15, min: 0 }, // Hiszpania-Austria
  12: { m: 7, day: 2, h: 19, min: 0 }, // Portugalia-Chorwacja
  13: { m: 7, day: 2, h: 23, min: 0 }, // Szwajcaria-Algieria
  14: { m: 7, day: 3, h: 14, min: 0 }, // Australia-Egipt
  15: { m: 7, day: 3, h: 18, min: 0 }, // Argentyna-Republika Ziel. Przylądka
  16: { m: 7, day: 3, h: 21, min: 30 }, // Kolumbia-Ghana
};

const DOW = ['niedziela', 'poniedz.', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
const MIES = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

/** Tekst terminu w polskim czasie (CEST = ET + 6h), w formacie jak tury grupowe. */
function plKickoff(month1: number, day: number, etHour: number, etMin: number): string {
  const utc = new Date(Date.UTC(2026, month1 - 1, day, etHour + 4, etMin)); // ET(UTC−4) → UTC
  const cest = new Date(utc.getTime() + 2 * 3600 * 1000); // UTC → CEST(UTC+2)
  const dow = DOW[cest.getUTCDay()];
  const hh = String(cest.getUTCHours()).padStart(2, '0');
  const mm = String(cest.getUTCMinutes()).padStart(2, '0');
  return `${dow}, ${cest.getUTCDate()} ${MIES[cest.getUTCMonth()]} godz. ${hh}.${mm}`;
}

const kickoffs: Record<number, string> = {};
for (const [no, s] of Object.entries(ET_SCHEDULE)) {
  kickoffs[Number(no)] = plKickoff(s.m, s.day, s.h, s.min);
}

const roster: Participant[] = JSON.parse(readFileSync(ROSTER, 'utf8'));
const sheet = openXlsx(readFileSync(BAZA)).sheet(SHEET);
const round: PucharRound = parseBazaPuchar(sheet, { round: '1/16', roster, nickAlias: NICK_ALIAS, kickoffs });

if (round.fixtures.length !== EXPECTED_FIXTURES) {
  throw new Error(`Oczekiwano ${EXPECTED_FIXTURES} meczów 1/16, jest ${round.fixtures.length}`);
}
const missingKickoff = round.fixtures.filter((f) => f.kickoff === '');
if (missingKickoff.length > 0) {
  throw new Error(`Brak terminu dla meczów: ${missingKickoff.map((f) => f.no).join(', ')}`);
}

writeFileSync(OUT, JSON.stringify({ rounds: [round] }, null, 2) + '\n');

const withTyp = Object.keys(round.predictions).length;
const noTyp = roster.filter((p) => !round.predictions[p.id]).map((p) => p.id);
let krzyzyki = 0;
for (const byMatch of Object.values(round.predictions))
  for (const pick of Object.values(byMatch)) if (pick.pk) krzyzyki++;
console.log(`OK: ${round.fixtures.length} meczów 1/16, ${withTyp}/${roster.length} graczy z typami, ${krzyzyki} krzyżyków → ${OUT}`);
console.log(`Bez ŻADNEGO typu (0 pkt): ${noTyp.length ? noTyp.join(', ') : '—'}`);
console.log('Terminarz 1/16 (polski czas):');
for (const f of round.fixtures) console.log(`  ${String(f.no).padStart(2)}: ${f.home} - ${f.away}  ||  ${f.kickoff}`);
