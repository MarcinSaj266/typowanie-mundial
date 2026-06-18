// CLI ingestu tury 2 (Konkurs 1). Źródło: płaski plik organizatora "Baza tura 2.xlsx"
// (arkusz t2: uczestnik × mecz × typ + nazwy drużyn). Pipeline:
//   Baza tura 2.xlsx + roster.json → parseBazaTura → data/k1/tura-2.json
// Terminy meczów nie ma w pliku — bierzemy z oficjalnego terminarza MŚ 2026 (ESPN),
// przeliczone z czasu ET (EDT = UTC−4) na POLSKI (CEST = UTC+2), czyli ET + 6h.
import { readFileSync, writeFileSync } from 'node:fs';
import { openXlsx } from './xlsx/workbook';
import { parseBazaTura } from './k1/parseBazaTura';
import type { Participant } from './k1/parseGrup1';

const BAZA = 'Baza tura 2.xlsx';
const ROSTER = 'data/k1/roster.json';
const OUT = 'data/k1/tura-2.json';

// Pisownia nicka w bazie → kanoniczny nick z rosteru (te same 5 aliasów co w turze 1).
const NICK_ALIAS: Record<string, string> = {
  WojtekN: 'Wojtek',
  'Turbo-Ryzu': 'Turbo-Ryżu',
  RafałCz: 'Rafał',
  'Sławek G.': 'Sławek',
  PawełS: 'PawełSt',
};

// Pisownia drużyny w bazie → kanoniczna nazwa (jak tura-1 / ingest/scores/teamMap.ts).
const TEAM_ALIAS: Record<string, string> = {
  'Wybrzeże Kości Słon.': 'Wybrzeże Koś. Słon.',
};

// Terminarz MŚ 2026, matchday 2 (źródło: ESPN). Numer naszego meczu → dzień czerwca + godzina ET.
const ET_SCHEDULE: Record<number, { day: number; etHour: number }> = {
  1: { day: 18, etHour: 12 }, // Czechy-RPA
  2: { day: 18, etHour: 15 }, // Szwajcaria-Bośnia
  3: { day: 18, etHour: 18 }, // Kanada-Katar
  4: { day: 18, etHour: 23 }, // Meksyk-Korea Płd.
  5: { day: 19, etHour: 15 }, // USA-Australia
  6: { day: 19, etHour: 18 }, // Szkocja-Maroko
  7: { day: 19, etHour: 21 }, // Brazylia-Haiti
  8: { day: 20, etHour: 0 }, // Turcja-Paragwaj (12 a.m. ET 20 cze)
  9: { day: 20, etHour: 13 }, // Holandia-Szwecja
  10: { day: 20, etHour: 16 }, // Niemcy-Wybrzeże Koś. Słon.
  11: { day: 20, etHour: 20 }, // Ekwador-Curacao
  12: { day: 21, etHour: 0 }, // Tunezja-Japonia (12 a.m. ET 21 cze)
  13: { day: 21, etHour: 12 }, // Hiszpania-Arabia Saudyjska
  14: { day: 21, etHour: 15 }, // Belgia-Iran
  15: { day: 21, etHour: 18 }, // Urugwaj-Rep. Ziel. Przylądka
  16: { day: 21, etHour: 21 }, // Nowa Zelandia-Egipt
  17: { day: 22, etHour: 13 }, // Argentyna-Austria
  18: { day: 22, etHour: 17 }, // Francja-Irak
  19: { day: 22, etHour: 20 }, // Norwegia-Senegal
  20: { day: 22, etHour: 23 }, // Jordania-Algieria
  21: { day: 23, etHour: 13 }, // Portugalia-Uzbekistan
  22: { day: 23, etHour: 16 }, // Anglia-Ghana
  23: { day: 23, etHour: 19 }, // Panama-Chorwacja
  24: { day: 23, etHour: 22 }, // Kolumbia-DR Konga
};

const DOW = ['niedziela', 'poniedz.', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];

/** Tekst terminu w polskim czasie (CEST = ET + 6h), w formacie jak tura-1. */
function plKickoff(day: number, etHour: number): string {
  const utc = new Date(Date.UTC(2026, 5, day, etHour + 4, 0)); // ET(UTC−4) → UTC
  const cest = new Date(utc.getTime() + 2 * 3600 * 1000); // UTC → CEST(UTC+2)
  const dow = DOW[cest.getUTCDay()];
  const hh = String(cest.getUTCHours()).padStart(2, '0');
  return `${dow}, ${cest.getUTCDate()} cze godz. ${hh}.00`;
}

const kickoffs: Record<number, string> = {};
for (const [no, { day, etHour }] of Object.entries(ET_SCHEDULE)) {
  kickoffs[Number(no)] = plKickoff(day, etHour);
}

const roster: Participant[] = JSON.parse(readFileSync(ROSTER, 'utf8'));
const sheet = openXlsx(readFileSync(BAZA)).sheet('t2');
const parsed = parseBazaTura(sheet, { turn: 2, roster, nickAlias: NICK_ALIAS, teamAlias: TEAM_ALIAS, kickoffs });

if (parsed.fixtures.length !== 24) {
  throw new Error(`Oczekiwano 24 meczów tury 2, jest ${parsed.fixtures.length}`);
}
const missingKickoff = parsed.fixtures.filter((f) => f.kickoff === '');
if (missingKickoff.length > 0) {
  throw new Error(`Brak terminu dla meczów: ${missingKickoff.map((f) => f.no).join(', ')}`);
}

writeFileSync(OUT, JSON.stringify(parsed, null, 2) + '\n');

const withTyp = Object.keys(parsed.predictions).length;
const noTyp = roster.filter((p) => !parsed.predictions[p.id]).map((p) => p.id);
console.log(`OK: ${parsed.fixtures.length} meczów, ${withTyp}/${roster.length} graczy z typami → ${OUT}`);
console.log(`Bez ŻADNEGO typu (0 pkt na razie): ${noTyp.length ? noTyp.join(', ') : '—'}`);
console.log('Terminarz tury 2 (polski czas):');
for (const f of parsed.fixtures) console.log(`  ${String(f.no).padStart(2)}: ${f.home} - ${f.away}  ||  ${f.kickoff}`);
